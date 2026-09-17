import { omit } from 'lodash';

import { type FieldConfigSource, type PanelPlugin } from '@grafana/data';

export function supportsDataQuery(plugin: PanelPlugin | undefined | null): boolean {
  return plugin?.meta.skipDataQuery === false;
}

export const updateDefaultFieldConfigValue = (
  config: FieldConfigSource,
  name: string,
  value: unknown,
  isCustom?: boolean
) => {
  let defaults = { ...config.defaults };
  const remove = value == null || value === '';

  if (isCustom) {
    if (defaults.custom) {
      if (remove) {
        defaults.custom = omit(defaults.custom, name);
      } else {
        defaults.custom = setOptionImmutably(defaults.custom, name, value);
      }
    } else if (!remove) {
      defaults.custom = setOptionImmutably(defaults.custom, name, value);
    }
  } else if (remove) {
    defaults = omit(defaults, name);
  } else {
    defaults = setOptionImmutably(defaults, name, value);
  }

  return {
    ...config,
    defaults,
  };
};

export function setOptionImmutably<T extends object>(options: T, path: string | string[], value: any): T {
  const splat = !Array.isArray(path) ? path.split('.') : path;

  const key = splat.shift()!;
  if (key.endsWith(']')) {
    const idx = key.lastIndexOf('[');
    const index = +key.substring(idx + 1, key.length - 1);
    const propKey = key.substring(0, idx);
    let current = (options as Record<string, any>)[propKey];
    const arr = Array.isArray(current) ? [...current] : [];
    if (splat.length) {
      current = arr[index];
      if (current == null || typeof current !== 'object') {
        current = {};
      }
      value = setOptionImmutably(current, splat, value);
    }
    arr[index] = value;
    return { ...options, [propKey]: arr };
  }

  if (!splat.length) {
    return { ...options, [key]: value };
  }

  let current = (options as Record<string, any>)[key];

  if (current == null || typeof current !== 'object') {
    current = {};
  }

  return { ...options, [key]: setOptionImmutably(current, splat, value) };
}
