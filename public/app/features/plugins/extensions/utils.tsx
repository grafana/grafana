import React from 'react';

import {
  type PluginExtensionLinkConfig,
  type PluginExtensionConfig,
  type PluginExtensionEventHelpers,
  PluginExtensionTypes,
} from '@grafana/data';
import { Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

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
export function getEventHelpers(context?: Readonly<object>): PluginExtensionEventHelpers {
  const openModal: PluginExtensionEventHelpers['openModal'] = ({ title, body }) => {
    appEvents.publish(new ShowModalReactEvent({ component: getModalWrapper({ title, body }) }));
  };

  return { openModal, context };
}

export type ModalWrapperProps = {
  onDismiss: () => void;
};

// Wraps a component with a modal.
// This way we can make sure that the modal is closable, and we also make the usage simpler.
export const getModalWrapper = ({
  // The title of the modal (appears in the header)
  title,
  // A component that serves the body of the modal
  body: Body,
}: Parameters<PluginExtensionEventHelpers['openModal']>[0]) => {
  const ModalWrapper = ({ onDismiss }: ModalWrapperProps) => {
    return (
      <Modal title={title} isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
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
  const str = `${pluginId}${extensionConfig.placement}${extensionConfig.title}`;

  return Array.from(str)
    .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
    .toString();
}
