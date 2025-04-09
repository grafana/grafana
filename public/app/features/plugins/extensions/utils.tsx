import { css } from '@emotion/css';
import { isArray, isObject } from 'lodash';
import * as React from 'react';
import { useAsync } from 'react-use';

import {
  type PluginExtensionEventHelpers,
  type PluginExtensionOpenModalOptions,
  isDateTime,
  dateTime,
  PluginContextProvider,
  PluginExtensionLink,
  PanelMenuItem,
  PluginExtensionAddedLinkConfig,
  urlUtil,
  PluginExtensionPoints,
  ExtensionInfo,
} from '@grafana/data';
import { reportInteraction, config, AppPluginConfig } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { ShowModalReactEvent } from 'app/types/events';

import { ExtensionsLog, log } from './logs/log';
import { AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { assertIsNotPromise, assertLinkPathIsValid, assertStringProps, isPromise } from './validators';

export function handleErrorsInFn(fn: Function, errorMessagePrefix = '') {
  return (...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (e) {
      if (e instanceof Error) {
        console.warn(`${errorMessagePrefix}${e.message}`);
      }
    }
  };
}

export function createOpenModalFunction(pluginId: string): PluginExtensionEventHelpers['openModal'] {
  return async (options) => {
    const { title, body, width, height } = options;

    appEvents.publish(
      new ShowModalReactEvent({
        component: wrapWithPluginContext<ModalWrapperProps>(
          pluginId,
          getModalWrapper({ title, body, width, height }),
          log
        ),
      })
    );
  };
}

type ModalWrapperProps = {
  onDismiss: () => void;
};

export const wrapWithPluginContext = <T,>(pluginId: string, Component: React.ComponentType<T>, log: ExtensionsLog) => {
  const WrappedExtensionComponent = (props: T & React.JSX.IntrinsicAttributes) => {
    const {
      error,
      loading,
      value: pluginMeta,
    } = useAsync(() => getPluginSettings(pluginId, { showErrorAlert: false }));

    if (loading) {
      return null;
    }

    if (error) {
      log.error(`Could not fetch plugin meta information for "${pluginId}", aborting. (${error.message})`, {
        stack: error.stack ?? '',
        message: error.message,
      });
      return null;
    }

    if (!pluginMeta) {
      log.error(`Fetched plugin meta information is empty for "${pluginId}", aborting.`);
      return null;
    }

    return (
      <PluginContextProvider meta={pluginMeta}>
        <Component {...props} />
      </PluginContextProvider>
    );
  };

  return WrappedExtensionComponent;
};

// Wraps a component with a modal.
// This way we can make sure that the modal is closable, and we also make the usage simpler.
const getModalWrapper = ({
  // The title of the modal (appears in the header)
  title,
  // A component that serves the body of the modal
  body: Body,
  width,
  height,
}: PluginExtensionOpenModalOptions) => {
  const className = css({ width, height });

  const ModalWrapper = ({ onDismiss }: ModalWrapperProps) => {
    return (
      <Modal title={title} className={className} isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
        <Body onDismiss={onDismiss} />
      </Modal>
    );
  };

  return ModalWrapper;
};

// Deep-clones and deep-freezes an object.
// (Returns with a new object, does not modify the original object)
//
// @param `object` The object to freeze
// @param `frozenProps` A set of objects that have already been frozen (used to prevent infinite recursion)
export function deepFreeze(value?: object | Record<string | symbol, unknown> | unknown[], frozenProps = new Map()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  // Deep cloning the object to prevent freezing the original object
  const clonedValue = Array.isArray(value) ? [...value] : { ...value };

  // Prevent infinite recursion by looking for cycles inside an object
  if (frozenProps.has(value)) {
    return frozenProps.get(value);
  }
  frozenProps.set(value, clonedValue);

  const propNames = Reflect.ownKeys(clonedValue);

  for (const name of propNames) {
    const prop = Array.isArray(clonedValue) ? clonedValue[Number(name)] : clonedValue[name];

    // If the property is an object:
    //   1. clone it
    //   2. freeze it
    if (prop && (typeof prop === 'object' || typeof prop === 'function')) {
      if (Array.isArray(clonedValue)) {
        clonedValue[Number(name)] = deepFreeze(prop, frozenProps);
      } else {
        clonedValue[name] = deepFreeze(prop, frozenProps);
      }
    }
  }

  return Object.freeze(clonedValue);
}

export function generateExtensionId(pluginId: string, extensionPointId: string, title: string): string {
  const str = `${pluginId}${extensionPointId}${title}`;

  return Array.from(str)
    .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
    .toString();
}

const _isProxy = Symbol('isReadOnlyProxy');

/**
 * Returns a proxy that wraps the given object in a way that makes it read only.
 * If you try to modify the object a TypeError exception will be thrown.
 *
 * @param obj The object to make read only
 * @returns A new read only object, does not modify the original object
 */
export function getReadOnlyProxy<T extends object>(obj: T): T {
  if (!obj || typeof obj !== 'object' || isReadOnlyProxy(obj)) {
    return obj;
  }

  const cache = new WeakMap();

  return new Proxy(obj, {
    defineProperty: () => false,
    deleteProperty: () => false,
    isExtensible: () => false,
    set: () => false,
    get(target, prop, receiver) {
      if (prop === _isProxy) {
        return true;
      }

      const value = Reflect.get(target, prop, receiver);

      // This will create a clone of the date time object
      // instead of creating a proxy because the underlying
      // momentjs object needs to be able to mutate itself.
      if (isDateTime(value)) {
        return dateTime(value);
      }

      if (isObject(value) || isArray(value)) {
        if (!cache.has(value)) {
          cache.set(value, getReadOnlyProxy(value));
        }
        return cache.get(value);
      }

      return value;
    },
  });
}

function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isReadOnlyProxy(value: unknown): boolean {
  return isRecord(value) && value[_isProxy] === true;
}

export function createAddedLinkConfig<T extends object>(
  config: PluginExtensionAddedLinkConfig<T>
): PluginExtensionAddedLinkConfig {
  const linkConfig: PluginExtensionAddedLinkConfig<T> = {
    ...config,
  };
  assertLinkConfig(linkConfig);
  return linkConfig;
}

function assertLinkConfig<T extends object>(
  config: PluginExtensionAddedLinkConfig<T>
): asserts config is PluginExtensionAddedLinkConfig {}

export function truncateTitle(title: string, length: number): string {
  if (title.length < length) {
    return title;
  }
  const part = title.slice(0, length - 3);
  return `${part.trimEnd()}...`;
}

export function createExtensionSubMenu(extensions: PluginExtensionLink[]): PanelMenuItem[] {
  const categorized: Record<string, PanelMenuItem[]> = {};
  const uncategorized: PanelMenuItem[] = [];

  for (const extension of extensions) {
    const category = extension.category;

    if (!category) {
      uncategorized.push({
        text: truncateTitle(extension.title, 25),
        href: extension.path,
        onClick: extension.onClick,
      });
      continue;
    }

    if (!Array.isArray(categorized[category])) {
      categorized[category] = [];
    }

    categorized[category].push({
      text: truncateTitle(extension.title, 25),
      href: extension.path,
      onClick: extension.onClick,
    });
  }

  const subMenu = Object.keys(categorized).reduce((subMenu: PanelMenuItem[], category) => {
    subMenu.push({
      text: truncateTitle(category, 25),
      type: 'group',
      subMenu: categorized[category],
    });
    return subMenu;
  }, []);

  if (uncategorized.length > 0) {
    if (subMenu.length > 0) {
      subMenu.push({
        text: 'divider',
        type: 'divider',
      });
    }

    Array.prototype.push.apply(subMenu, uncategorized);
  }

  return subMenu;
}

export function getLinkExtensionOverrides(
  pluginId: string,
  config: AddedLinkRegistryItem,
  log: ExtensionsLog,
  context?: object
) {
  try {
    const overrides = config.configure?.(context);

    // Hiding the extension
    if (overrides === undefined) {
      return undefined;
    }

    let {
      title = config.title,
      description = config.description,
      path = config.path,
      icon = config.icon,
      category = config.category,
      ...rest
    } = overrides;

    assertIsNotPromise(
      overrides,
      `The configure() function for "${config.title}" returned a promise, skipping updates.`
    );

    path && assertLinkPathIsValid(pluginId, path);
    assertStringProps({ title, description }, ['title', 'description']);

    if (Object.keys(rest).length > 0) {
      log.warning(
        `Extension "${config.title}", is trying to override restricted properties: ${Object.keys(rest).join(
          ', '
        )} which will be ignored.`
      );
    }

    return {
      title,
      description,
      path,
      icon,
      category,
    };
  } catch (error) {
    if (error instanceof Error) {
      log.error(`Failed to configure link with title "${config.title}"`, {
        stack: error.stack ?? '',
        message: error.message,
      });
    }

    // If there is an error, we hide the extension
    // (This seems to be safest option in case the extension is doing something wrong.)
    return undefined;
  }
}

export function getLinkExtensionOnClick(
  pluginId: string,
  extensionPointId: string,
  config: AddedLinkRegistryItem,
  log: ExtensionsLog,
  context?: object
): ((event?: React.MouseEvent) => void) | undefined {
  const { onClick } = config;

  if (!onClick) {
    return;
  }

  return function onClickExtensionLink(event?: React.MouseEvent) {
    try {
      reportInteraction('ui_extension_link_clicked', {
        pluginId: pluginId,
        extensionPointId,
        title: config.title,
        category: config.category,
      });

      const helpers: PluginExtensionEventHelpers = {
        context,
        openModal: createOpenModalFunction(pluginId),
      };

      log.debug(`onClick '${config.title}' at '${extensionPointId}'`);
      const result = onClick(event, helpers);

      if (isPromise(result)) {
        result.catch((error) => {
          if (error instanceof Error) {
            log.error(error.message, {
              message: error.message,
              stack: error.stack ?? '',
            });
          }
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        log.error(error.message, {
          message: error.message,
          stack: error.stack ?? '',
        });
      }
    }
  };
}

export function getLinkExtensionPathWithTracking(pluginId: string, path: string, extensionPointId: string): string {
  return urlUtil.appendQueryToUrl(
    path,
    urlUtil.toUrlParams({
      uel_pid: pluginId,
      uel_epid: extensionPointId,
    })
  );
}

// Comes from the `app_mode` setting in the Grafana config (defaults to "development")
// Can be set with the `GF_DEFAULT_APP_MODE` environment variable
export const isGrafanaDevMode = () => config.buildInfo.env === 'development';

export const getAppPluginConfigs = (pluginIds: string[] = []) =>
  Object.values(config.apps).filter((app) => pluginIds.includes(app.id));

export const getAppPluginIdFromExposedComponentId = (exposedComponentId: string) => {
  return exposedComponentId.split('/')[0];
};

// Returns a list of app plugin ids that are registering extensions to this extension point.
// (These plugins are necessary to be loaded to use the extension point.)
// (The function also returns the plugin ids that the plugins - that extend the extension point - depend on.)
export const getExtensionPointPluginDependencies = (extensionPointId: string): string[] => {
  return Object.values(config.apps)
    .filter(
      (app) =>
        app.extensions.addedLinks.some((link) => link.targets.includes(extensionPointId)) ||
        app.extensions.addedComponents.some((component) => component.targets.includes(extensionPointId))
    )
    .map((app) => app.id)
    .reduce((acc: string[], id: string) => {
      return [...acc, id, ...getAppPluginDependencies(id)];
    }, []);
};

export type ExtensionPointPluginMeta = Map<
  string,
  {
    readonly addedComponents: ExtensionInfo[];
    readonly addedLinks: ExtensionInfo[];
  }
>;

/**
 * Returns a map of plugin ids and their addedComponents and addedLinks to the extension point.
 * @param extensionPointId - The id of the extension point.
 * @returns A map of plugin ids and their addedComponents and addedLinks to the extension point.
 */
export const getExtensionPointPluginMeta = (extensionPointId: string): ExtensionPointPluginMeta => {
  return new Map(
    getExtensionPointPluginDependencies(extensionPointId)
      .map((pluginId) => {
        const app = config.apps[pluginId];
        // if the plugin does not exist or does not expose any components or links to the extension point, return undefined
        if (
          !app ||
          (!app.extensions.addedComponents.some((component) => component.targets.includes(extensionPointId)) &&
            !app.extensions.addedLinks.some((link) => link.targets.includes(extensionPointId)))
        ) {
          return undefined;
        }
        return [
          pluginId,
          {
            addedComponents: app.extensions.addedComponents.filter((component) =>
              component.targets.includes(extensionPointId)
            ),
            addedLinks: app.extensions.addedLinks.filter((link) => link.targets.includes(extensionPointId)),
          },
        ] as const;
      })
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
  );
};

// Returns a list of app plugin ids that are necessary to be loaded to use the exposed component.
// (It is first the plugin that exposes the component, and then the ones that it depends on.)
export const getExposedComponentPluginDependencies = (exposedComponentId: string) => {
  const pluginId = getAppPluginIdFromExposedComponentId(exposedComponentId);

  return [pluginId].reduce((acc: string[], pluginId: string) => {
    return [...acc, pluginId, ...getAppPluginDependencies(pluginId)];
  }, []);
};

// Returns a list of app plugin ids that are necessary to be loaded, based on the `dependencies.extensions`
// metadata field. (For example the plugins that expose components that the app depends on.)
// Heads up! This is a recursive function.
export const getAppPluginDependencies = (pluginId: string, visited: string[] = []): string[] => {
  if (!config.apps[pluginId]) {
    return [];
  }

  // Prevent infinite recursion (it would happen if there is a circular dependency between app plugins)
  if (visited.includes(pluginId)) {
    return [];
  }

  const pluginIdDependencies = config.apps[pluginId].dependencies.extensions.exposedComponents.map(
    getAppPluginIdFromExposedComponentId
  );

  return (
    pluginIdDependencies
      .reduce((acc, _pluginId) => {
        return [...acc, ...getAppPluginDependencies(_pluginId, [...visited, pluginId])];
      }, pluginIdDependencies)
      // We don't want the plugin to "depend on itself"
      .filter((id) => id !== pluginId)
  );
};

// Returns a list of app plugins that has to be loaded before core Grafana could finish the initialization.
export const getAppPluginsToAwait = () => {
  const pluginIds = [
    // The "cloud-home-app" is registering banners once it's loaded, and this can cause a rerender in the AppChrome if it's loaded after the Grafana app init.
    'cloud-home-app',
  ];

  return Object.values(config.apps).filter((app) => pluginIds.includes(app.id));
};

// Returns a list of app plugins that has to be preloaded in parallel with the core Grafana initialization.
export const getAppPluginsToPreload = () => {
  // The DashboardPanelMenu extension point is using the `getPluginExtensions()` API in scenes at the moment, which means that it cannot yet benefit from dynamic plugin loading.
  const dashboardPanelMenuPluginIds = getExtensionPointPluginDependencies(PluginExtensionPoints.DashboardPanelMenu);
  const awaitedPluginIds = getAppPluginsToAwait().map((app) => app.id);
  const isNotAwaited = (app: AppPluginConfig) => !awaitedPluginIds.includes(app.id);

  return Object.values(config.apps).filter((app) => {
    return isNotAwaited(app) && (app.preload || dashboardPanelMenuPluginIds.includes(app.id));
  });
};
