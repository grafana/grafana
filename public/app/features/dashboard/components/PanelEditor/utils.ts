import { omit, omitBy } from 'lodash';

import {
  type DynamicConfigValue,
  type FieldConfigSource,
  type PanelPlugin,
  type ThresholdsConfig,
} from '@grafana/data';
import {
  isThresholdStepVarMappingKey,
  isVarMappingProp,
  splitThresholdStepExpressions,
  thresholdStepVarMappingKey,
  unwrapVarMappingPropId,
  wrapVarMappingPropId,
} from '@grafana/data/internal';

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

export function hasThresholdSteps(value: unknown): value is ThresholdsConfig {
  return typeof value === 'object' && value !== null && 'steps' in value && Array.isArray(value.steps);
}

/**
 * Gives each threshold step its stored expression as `valueExpr`, which is how `ThresholdsEditor`
 * shows and edits expressions. Its output goes back through `splitThresholdStepExpressions`, so
 * expressions follow their step through sorting, adding and removing.
 */
export function withThresholdStepExpressions(
  thresholds: ThresholdsConfig | undefined,
  getExpression: (key: string) => unknown
): ThresholdsConfig | undefined {
  if (!thresholds?.steps) {
    return thresholds;
  }

  const steps = thresholds.steps.map((step, index) => {
    const expression = index > 0 ? getExpression(thresholdStepVarMappingKey(index)) : undefined;
    return typeof expression === 'string' ? { ...step, valueExpr: expression } : step;
  });

  return { ...thresholds, steps };
}

/** Replaces every `thresholds.steps.<i>` key in `defaults.varMappings` with `expressions`. */
export function updateDefaultThresholdStepVarMappings(
  config: FieldConfigSource,
  expressions: Record<string, string>
): FieldConfigSource {
  const varMappings = {
    ...omitBy(config.defaults.varMappings, (_, key) => isThresholdStepVarMappingKey(key)),
    ...expressions,
  };
  const defaults = Object.keys(varMappings).length
    ? { ...config.defaults, varMappings }
    : omit(config.defaults, 'varMappings');

  return { ...config, defaults };
}

export const isThresholdStepVarMappingProp = (prop: DynamicConfigValue) =>
  isVarMappingProp(prop) && isThresholdStepVarMappingKey(unwrapVarMappingPropId(prop.id));

/**
 * Sets the thresholds property at `index` of an override rule and replaces the rule's
 * `varMappings.thresholds.steps.<i>` entries with the editor's step expressions.
 */
export function updateOverrideThresholds(
  properties: DynamicConfigValue[],
  index: number,
  value: ThresholdsConfig
): DynamicConfigValue[] {
  const { thresholds, expressions } = splitThresholdStepExpressions(value);

  return [
    ...properties
      .map((prop, i) => (i === index ? { ...prop, value: thresholds } : prop))
      .filter((prop) => !isThresholdStepVarMappingProp(prop)),
    ...Object.entries(expressions).map(([key, expression]) => ({ id: wrapVarMappingPropId(key), value: expression })),
  ];
}

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
