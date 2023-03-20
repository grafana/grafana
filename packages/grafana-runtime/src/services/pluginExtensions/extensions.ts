import { type PluginExtension } from '@grafana/data';

import { getPluginsExtensionRegistry } from './registry';

export type PluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
};

export type PluginExtensionsResult = {
  extensions: PluginExtension[];
};

export function getPluginExtensions<T extends object = {}>(
  options: PluginExtensionsOptions<T>
): PluginExtensionsResult {
  const { placement, context } = options;
  const registry = getPluginsExtensionRegistry();
  const configureFuncs = registry[placement] ?? [];
  const frozenContext = deepFreeze({ ...context });

  const extensions = configureFuncs.reduce<PluginExtension[]>((result, configure) => {
    const extension = configure(frozenContext);
    if (extension) {
      result.push(extension);
    }

    return result;
  }, []);

  return {
    extensions: extensions,
  };
}

// Freezes an object and all its properties recursively
// (Returns with the frozen object, however it's not a copy, the original object becomes frozen, too.)
// @param `object` The object to freeze
// @param `frozenProps` A set of objects that have already been frozen (used to prevent infinite recursion)
export function deepFreeze<T extends object = {}>(object: T, frozenProps = new Set()): T {
  if (!object || typeof object !== 'object' || Object.isFrozen(object)) {
    return object;
  }

  // Prevent infinite recursion by looking for cycles inside an object
  if (frozenProps.has(object)) {
    return object;
  }
  frozenProps.add(object);

  const propNames = Reflect.ownKeys(object);

  for (const name of propNames) {
    // @ts-ignore
    const value = object[name];

    if (value && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value, frozenProps);
    }
  }

  return Object.freeze(object);
}
