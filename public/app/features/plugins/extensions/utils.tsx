import { css } from '@emotion/css';
import { cloneDeep, isArray, isObject } from 'lodash';
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
import { CloseExtensionSidebarEvent, OpenExtensionSidebarEvent, ShowModalReactEvent } from 'app/types/events';

import { RestrictedGrafanaApisProvider } from '../components/restrictedGrafanaApis/RestrictedGrafanaApisProvider';

import { ExtensionErrorBoundary } from './ExtensionErrorBoundary';
import { ExtensionsLog, log as baseLog } from './logs/log';
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

export function createOpenModalFunction(config: AddedLinkRegistryItem): PluginExtensionEventHelpers['openModal'] {
  return async (options) => {
    const { title, body, width, height } = options;

    appEvents.publish(
      new ShowModalReactEvent({
        component: wrapWithPluginContext<ModalWrapperProps>({
          pluginId: config.pluginId,
          extensionTitle: config.title,
          Component: getModalWrapper({ title, body, width, height, config }),
          log: baseLog,
        }),
      })
    );
  };
}

type ModalWrapperProps = {
  onDismiss: () => void;
};

export const wrapWithPluginContext = <T,>({
  pluginId,
  extensionTitle,
  Component,
  log,
}: {
  pluginId: string;
  extensionTitle: string;
  Component: React.ComponentType<T>;
  log: ExtensionsLog;
}) => {
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
        <ExtensionErrorBoundary pluginId={pluginId} extensionTitle={extensionTitle} log={log}>
          <RestrictedGrafanaApisProvider pluginId={pluginId}>
            <Component
              {...writableProxy(props, { log, source: 'extension', pluginId, pluginVersion: pluginMeta.info?.version })}
            />
          </RestrictedGrafanaApisProvider>
        </ExtensionErrorBoundary>
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
  config,
}: PluginExtensionOpenModalOptions & { config: AddedLinkRegistryItem }) => {
  const className = css({ width, height });

  const ModalWrapper = ({ onDismiss }: ModalWrapperProps) => {
    return (
      <Modal title={title} className={className} isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
        {/* 
          We also add an error boundary here (apart from the one in the `wrapWithPluginContext`) 
          so the error appears inside the modal (and not at the bottom of the page.)
        */}
        <ExtensionErrorBoundary
          pluginId={config.pluginId}
          extensionTitle={config.title}
          fallbackAlwaysVisible={true}
          log={baseLog}
        >
          <div data-plugin-sandbox={config.pluginId} data-testid="plugin-sandbox-wrapper">
            <Body onDismiss={onDismiss} />
          </div>
        </ExtensionErrorBoundary>
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

const _isReadOnlyProxy = Symbol('isReadOnlyProxy');
const _isMutationObserverProxy = Symbol('isMutationObserverProxy');

export class ReadOnlyProxyError extends Error {
  constructor(message?: string) {
    super(message ?? 'Mutating a read-only proxy object');
    this.name = 'ReadOnlyProxyError';
  }
}

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
      if (prop === _isReadOnlyProxy) {
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

type MutationSource = 'extension' | 'datasource';
interface ProxyOptions {
  log?: ExtensionsLog;
  source?: MutationSource;
  pluginId?: string;
  pluginVersion?: string;
}

/**
 * Returns a proxy that logs any attempted mutation to the original object.
 *
 * @param obj The object to observe
 * @param options The options for the proxy
 * @param options.log The logger to use
 * @param options.source The source of the mutation
 * @param options.pluginId The id of the plugin that is mutating the object
 * @param options.pluginVersion The version of the plugin that is mutating the object
 * @returns A new proxy object that logs any attempted mutation to the original object
 */
export function getMutationObserverProxy<T extends object>(obj: T, options?: ProxyOptions): T {
  if (!obj || typeof obj !== 'object' || isMutationObserverProxy(obj)) {
    return obj;
  }

  const { log = baseLog, source = 'extension', pluginId = 'unknown', pluginVersion = 'unknown' } = options ?? {};
  const cache = new WeakMap();
  const logFunction = isGrafanaDevMode() ? log.error.bind(log) : log.warning.bind(log); // should show error during local development

  return new Proxy(obj, {
    deleteProperty(target, prop) {
      logFunction(
        `Attempted to delete object property "${String(prop)}" from ${source} with id ${pluginId} and version ${pluginVersion}`,
        {
          stack: new Error().stack ?? '',
        }
      );
      Reflect.deleteProperty(target, prop);
      return true;
    },
    defineProperty(target, prop, descriptor) {
      // because immer (used by RTK) calls Object.isFrozen and Object.freeze we know that defineProperty will be called
      // behind the scenes as well so we only log message with debug level to minimize the noise and false positives
      log.debug(
        `Attempted to define object property "${String(prop)}" from ${source} with id ${pluginId} and version ${pluginVersion}`,
        {
          stack: new Error().stack ?? '',
        }
      );
      Reflect.defineProperty(target, prop, descriptor);
      return true;
    },
    set(target, prop, newValue) {
      logFunction(
        `Attempted to mutate object property "${String(prop)}" from ${source} with id ${pluginId} and version ${pluginVersion}`,
        {
          stack: new Error().stack ?? '',
        }
      );
      Reflect.set(target, prop, newValue);
      return true;
    },
    get(target, prop, receiver) {
      if (prop === _isMutationObserverProxy) {
        return true;
      }

      const value = Reflect.get(target, prop, receiver);

      // Return read-only properties as-is to avoid proxy invariant violations
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (descriptor && !descriptor.configurable && !descriptor.writable) {
        return value;
      }

      // This will create a clone of the date time object
      // instead of creating a proxy because the underlying
      // momentjs object needs to be able to mutate itself.
      if (isDateTime(value)) {
        return dateTime(value);
      }

      if (isObject(value) || isArray(value)) {
        if (!cache.has(value)) {
          cache.set(value, getMutationObserverProxy(value, { log, source, pluginId, pluginVersion }));
        }
        return cache.get(value);
      }

      return value;
    },
  });
}

/**
 * Returns a proxy that logs any attempted mutation to the original object.
 *
 * @param value The object to observe
 * @param options The options for the proxy
 * @param options.log The logger to use
 * @param options.source The source of the mutation
 * @param options.pluginId The id of the plugin that is mutating the object
 * @param options.pluginVersion The version of the plugin that is mutating the object
 * @returns A new proxy object that logs any attempted mutation to the original object
 */
export function writableProxy<T>(value: T, options?: ProxyOptions): T {
  // Primitive types are read-only by default
  if (!value || typeof value !== 'object') {
    return value;
  }

  const { log = baseLog, source = 'extension', pluginId = 'unknown', pluginVersion = 'unknown' } = options ?? {};

  // Default: we return a proxy of a deep-cloned version of the original object, which logs warnings when mutation is attempted
  return getMutationObserverProxy(cloneDeep(value), { log, pluginId, pluginVersion, source });
}

function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isReadOnlyProxy(value: unknown): boolean {
  return isRecord(value) && value[_isReadOnlyProxy] === true;
}

export function isMutationObserverProxy(value: unknown): boolean {
  return isRecord(value) && value[_isMutationObserverProxy] === true;
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
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
        openModal: createOpenModalFunction(config),
        openSidebar: (componentTitle, context) => {
          appEvents.publish(
            new OpenExtensionSidebarEvent({
              props: context,
              pluginId,
              componentTitle,
            })
          );
        },
        closeSidebar: () => {
          appEvents.publish(new CloseExtensionSidebarEvent());
        },
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
