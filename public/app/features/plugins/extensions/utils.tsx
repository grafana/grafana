import { css } from '@emotion/css';
import { isArray, isObject } from 'lodash';
import * as React from 'react';
import { useAsync } from 'react-use';

import {
  type PluginExtensionLinkConfig,
  type PluginExtensionConfig,
  type PluginExtensionEventHelpers,
  PluginExtensionTypes,
  type PluginExtensionOpenModalOptions,
  isDateTime,
  dateTime,
  PluginContextProvider,
  PluginExtensionLink,
  PanelMenuItem,
  PluginExtensionAddedLinkConfig,
  urlUtil,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';
import { ShowModalReactEvent } from 'app/types/events';

import { AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { assertIsNotPromise, assertLinkPathIsValid, assertStringProps, isPromise } from './validators';

export function logWarning(message: string) {
  console.warn(`[Plugin Extensions] ${message}`);
}

export function isPluginExtensionLinkConfig(
  extension: PluginExtensionConfig | undefined
): extension is PluginExtensionLinkConfig {
  return typeof extension === 'object' && 'type' in extension && extension['type'] === PluginExtensionTypes.link;
}

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

// Event helpers are designed to make it easier to trigger "core actions" from an extension event handler, e.g. opening a modal or showing a notification.
export function getEventHelpers(pluginId: string, context?: Readonly<object>): PluginExtensionEventHelpers {
  const openModal: PluginExtensionEventHelpers['openModal'] = async (options) => {
    const { title, body, width, height } = options;

    appEvents.publish(
      new ShowModalReactEvent({
        component: wrapWithPluginContext<ModalWrapperProps>(pluginId, getModalWrapper({ title, body, width, height })),
      })
    );
  };

  return { openModal, context };
}

type ModalWrapperProps = {
  onDismiss: () => void;
};

export const wrapWithPluginContext = <T,>(pluginId: string, Component: React.ComponentType<T>) => {
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
      logWarning(`Could not fetch plugin meta information for "${pluginId}", aborting. (${error.message})`);
      return null;
    }

    if (!pluginMeta) {
      logWarning(`Fetched plugin meta information is empty for "${pluginId}", aborting.`);
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

export function generateExtensionId(pluginId: string, extensionConfig: PluginExtensionConfig): string {
  const str = `${pluginId}${extensionConfig.extensionPointId}${extensionConfig.title}`;

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

export function getLinkExtensionOverrides(pluginId: string, config: AddedLinkRegistryItem, context?: object) {
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
      logWarning(
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
      logWarning(error.message);
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

      const result = onClick(event, getEventHelpers(pluginId, context));

      if (isPromise(result)) {
        result.catch((e) => {
          if (e instanceof Error) {
            logWarning(e.message);
          }
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        logWarning(error.message);
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
