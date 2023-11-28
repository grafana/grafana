import { css } from '@emotion/css';
import { isArray, isObject } from 'lodash';
import React from 'react';
import { PluginExtensionTypes, } from '@grafana/data';
import { Modal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';
export function logWarning(message) {
    console.warn(`[Plugin Extensions] ${message}`);
}
export function isPluginExtensionLinkConfig(extension) {
    return typeof extension === 'object' && 'type' in extension && extension['type'] === PluginExtensionTypes.link;
}
export function isPluginExtensionComponentConfig(extension) {
    return typeof extension === 'object' && 'type' in extension && extension['type'] === PluginExtensionTypes.component;
}
export function handleErrorsInFn(fn, errorMessagePrefix = '') {
    return (...args) => {
        try {
            return fn(...args);
        }
        catch (e) {
            if (e instanceof Error) {
                console.warn(`${errorMessagePrefix}${e.message}`);
            }
        }
    };
}
// Event helpers are designed to make it easier to trigger "core actions" from an extension event handler, e.g. opening a modal or showing a notification.
export function getEventHelpers(context) {
    const openModal = (options) => {
        const { title, body, width, height } = options;
        appEvents.publish(new ShowModalReactEvent({
            component: getModalWrapper({ title, body, width, height }),
        }));
    };
    return { openModal, context };
}
// Wraps a component with a modal.
// This way we can make sure that the modal is closable, and we also make the usage simpler.
const getModalWrapper = ({ 
// The title of the modal (appears in the header)
title, 
// A component that serves the body of the modal
body: Body, width, height, }) => {
    const className = css({ width, height });
    const ModalWrapper = ({ onDismiss }) => {
        return (React.createElement(Modal, { title: title, className: className, isOpen: true, onDismiss: onDismiss, onClickBackdrop: onDismiss },
            React.createElement(Body, { onDismiss: onDismiss })));
    };
    return ModalWrapper;
};
// Deep-clones and deep-freezes an object.
// (Returns with a new object, does not modify the original object)
//
// @param `object` The object to freeze
// @param `frozenProps` A set of objects that have already been frozen (used to prevent infinite recursion)
export function deepFreeze(value, frozenProps = new Map()) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    // Deep cloning the object to prevent freezing the original object
    const clonedValue = Array.isArray(value) ? [...value] : Object.assign({}, value);
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
            }
            else {
                clonedValue[name] = deepFreeze(prop, frozenProps);
            }
        }
    }
    return Object.freeze(clonedValue);
}
export function generateExtensionId(pluginId, extensionConfig) {
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
export function getReadOnlyProxy(obj) {
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
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function isReadOnlyProxy(value) {
    return isRecord(value) && value[_isProxy] === true;
}
export function createExtensionLinkConfig(config) {
    const linkConfig = Object.assign({ type: PluginExtensionTypes.link }, config);
    assertLinkConfig(linkConfig);
    return linkConfig;
}
function assertLinkConfig(config) {
    if (config.type !== PluginExtensionTypes.link) {
        throw Error('config is not a extension link');
    }
}
export function truncateTitle(title, length) {
    if (title.length < length) {
        return title;
    }
    const part = title.slice(0, length - 3);
    return `${part.trimEnd()}...`;
}
//# sourceMappingURL=utils.js.map