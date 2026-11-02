import { omit } from 'lodash';

import {
  type FieldConfigPropertyItem,
  type FieldConfigSource,
  type PanelPlugin,
  standardEditorsRegistry,
} from '@grafana/data';
import { getVarMappingKind, type VarMappingKind } from '@grafana/data/internal';

/**
 * The kind of expression the panel editor lets a property take, or `undefined` for none. A slider
 * keeps its slider, since a text input in its place would lose the slider for every value.
 */
export function getVarMappingEditingKind(
  item: Pick<FieldConfigPropertyItem, 'id' | 'process' | 'editor'>
): VarMappingKind | undefined {
  const kind = getVarMappingKind(item);
  return kind === 'number' && item.editor === standardEditorsRegistry.getIfExists('slider')?.editor ? undefined : kind;
}

/**
 * Sets or clears `defaults.varMappings[id]`. Unlike `updateDefaultFieldConfigValue`, `id` is the
 * full property id (`custom.lineWidth`, not a path inside `custom`). Clearing the last entry
 * removes `varMappings`.
 */
export const updateDefaultFieldConfigVarMapping = (
  config: FieldConfigSource,
  id: string,
  expr: string | undefined
): FieldConfigSource => {
  const current = config.defaults.varMappings;

  if (expr === undefined) {
    if (!current || !(id in current)) {
      return config;
    }
    const varMappings = omit(current, id);
    const defaults = Object.keys(varMappings).length
      ? { ...config.defaults, varMappings }
      : omit(config.defaults, 'varMappings');
    return { ...config, defaults };
  }

  return { ...config, defaults: { ...config.defaults, varMappings: { ...current, [id]: expr } } };
};

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

export function setOptionImmutably<T extends object>(options: T, path: string | string[], value: unknown): T {
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
