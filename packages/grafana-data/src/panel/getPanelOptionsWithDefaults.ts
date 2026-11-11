import { mergeWith, isArray, isObject, set, unset, isEqual, pickBy } from 'lodash';

import { type FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { fieldColorModeRegistry } from '../field/fieldColor';
import { type FieldColorConfigSettings } from '../field/overrides/processors';
import { FieldColorModeId } from '../types/fieldColor';
import {
  type ConfigOverrideRule,
  type DynamicConfigValue,
  FieldConfigProperty,
  type FieldConfigSource,
} from '../types/fieldOverrides';
import { type ThresholdsConfig, ThresholdsMode } from '../types/thresholds';

import { type PanelPlugin } from './PanelPlugin';

interface Props {
  plugin: PanelPlugin;
  currentFieldConfig: FieldConfigSource;
  currentOptions: Record<string, unknown>;
  isAfterPluginChange: boolean;
}

export interface OptionDefaults {
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

/**
 * This will return the panel options with defaults applied.
 * Used internally, not intended for external use.
 * @internal
 */
export function getPanelOptionsWithDefaults({
  plugin,
  currentOptions,
  currentFieldConfig,
  isAfterPluginChange,
}: Props): OptionDefaults {
  const optionsWithDefaults = mergeWith({}, plugin.defaults, currentOptions || {}, (objValue, srcValue) => {
    if (isArray(srcValue)) {
      return srcValue;
    }
    return;
  });

  const fieldConfigWithDefaults = applyFieldConfigDefaults(currentFieldConfig, plugin);
  const fieldConfigWithOptimalColorMode = adaptFieldColorMode(plugin, fieldConfigWithDefaults, isAfterPluginChange);

  return { options: optionsWithDefaults, fieldConfig: fieldConfigWithOptimalColorMode };
}

function applyFieldConfigDefaults(existingFieldConfig: FieldConfigSource, plugin: PanelPlugin): FieldConfigSource {
  const pluginDefaults = plugin.fieldConfigDefaults;

  const result: FieldConfigSource = {
    defaults: mergeWith(
      {},
      pluginDefaults.defaults,
      existingFieldConfig ? existingFieldConfig.defaults : {},
      (objValue, srcValue) => {
        if (isArray(srcValue)) {
          return srcValue;
        }
        return;
      }
    ),
    overrides: existingFieldConfig?.overrides ?? [],
  };

  cleanProperties(result.defaults, '', plugin.fieldConfigRegistry);

  // Thresholds base values are null in JSON but need to be converted to -Infinity
  if (result.defaults.thresholds) {
    fixThresholds(result.defaults.thresholds);
  }

  // Filter out overrides for properties that cannot be found in registry. varMappings.<id>
  // entries are not registered themselves, so check the property they map.
  result.overrides = filterFieldConfigOverrides(result.overrides, (prop) => {
    if (isVarMappingProp(prop)) {
      return plugin.fieldConfigRegistry.getIfExists(unwrapVarMappingPropId(prop.id)) !== undefined;
    }
    return plugin.fieldConfigRegistry.getIfExists(prop.id) !== undefined;
  });

  for (const override of result.overrides) {
    for (const property of override.properties) {
      if (property.id === 'thresholds') {
        fixThresholds(property.value);
      }
    }
  }

  return result;
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function filterFieldConfigOverrides(
  overrides: ConfigOverrideRule[],
  condition: (value: DynamicConfigValue) => boolean
): ConfigOverrideRule[] {
  return overrides.map((x) => {
    const properties = x.properties.filter(condition);

    return {
      ...x,
      properties,
    };
  });
}

function cleanProperties(obj: object, parentPath: string, fieldConfigRegistry: FieldConfigOptionsRegistry) {
  let found = false;

  for (const [propName, value] of Object.entries(obj)) {
    // varMappings is not a registered property and its keys are property ids, not paths, so its
    // keys are pruned by the property they map instead, like varMappings.<id> override entries.
    if (parentPath === '' && propName === 'varMappings') {
      const kept = isObject(value) ? Object.entries(value).filter(([key]) => fieldConfigRegistry.getIfExists(key)) : [];
      if (kept.length === 0) {
        unset(obj, propName);
      } else {
        set(obj, propName, Object.fromEntries(kept));
        found = true;
      }
      continue;
    }

    const fullPath = `${parentPath}${propName}`;
    const existsInRegistry = !!fieldConfigRegistry.getIfExists(fullPath);

    // need to check early here as some standard properties have nested properies
    if (existsInRegistry) {
      found = true;
      continue;
    }

    if (isArray(value) || !isObject(value)) {
      if (!existsInRegistry) {
        unset(obj, propName);
      }
    } else {
      const childPropFound = cleanProperties(value, `${fullPath}.`, fieldConfigRegistry);
      // If no child props found unset the main object
      if (!childPropFound) {
        unset(obj, propName);
      }
    }
  }

  return found;
}

function adaptFieldColorMode(
  plugin: PanelPlugin,
  fieldConfig: FieldConfigSource,
  isAfterPluginChange: boolean
): FieldConfigSource {
  if (!isAfterPluginChange) {
    return fieldConfig;
  }

  // adjust to prefered field color setting if needed
  const color = plugin.fieldConfigRegistry.getIfExists(FieldConfigProperty.Color);

  if (color && color.settings) {
    const colorSettings: FieldColorConfigSettings = color.settings;
    const mode = fieldColorModeRegistry.getIfExists(fieldConfig.defaults.color?.mode);

    // When no support fo value colors, use classic palette
    if (!colorSettings.byValueSupport) {
      if (!mode || mode.isByValue) {
        fieldConfig.defaults.color = { mode: FieldColorModeId.PaletteClassic };
        return fieldConfig;
      }
    }

    // When supporting value colors and prefering thresholds, use Thresholds mode.
    // Otherwise keep current mode
    if (colorSettings.byValueSupport && colorSettings.preferThresholdsMode && mode?.id !== FieldColorModeId.Fixed) {
      if (!mode || !mode.isByValue) {
        fieldConfig.defaults.color = { mode: FieldColorModeId.Thresholds };
        return fieldConfig;
      }
    }

    // If panel support bySeries then we should default to that when switching to this panel as that is most likely
    // what users will expect. Example scenario a user who has a graph panel (time series) and switches to Gauge and
    // then back to time series we want the graph panel color mode to reset to classic palette and not preserve the
    // Gauge prefered thresholds mode.
    if (colorSettings.bySeriesSupport && mode?.isByValue) {
      fieldConfig.defaults.color = { mode: FieldColorModeId.PaletteClassic };
      return fieldConfig;
    }
  }
  return fieldConfig;
}

function fixThresholds(thresholds: ThresholdsConfig) {
  if (!thresholds.mode) {
    thresholds.mode = ThresholdsMode.Absolute;
  }

  if (!thresholds.steps) {
    thresholds.steps = [];
  } else if (thresholds.steps.length) {
    // First value is always -Infinity
    // JSON saves it as null
    thresholds.steps[0].value = -Infinity;
  }
}

/**
 * Removes the custom options, which belong to the previous visualization, and their expressions.
 * Used internally, not intended for external use.
 * @internal
 */
export function clearCustomFieldConfig(fieldConfig: FieldConfigSource): FieldConfigSource {
  return {
    defaults: { ...clearCustomVarMappings(fieldConfig.defaults), custom: {} },
    overrides: filterFieldConfigOverrides(fieldConfig.overrides, isStandardFieldProp),
  };
}

/**
 * Removes the expressions for custom options from the defaults, for when their custom options are replaced.
 * Used internally, not intended for external use.
 * @internal
 */
export function clearCustomVarMappings(defaults: FieldConfigSource['defaults']): FieldConfigSource['defaults'] {
  const { varMappings, ...rest } = defaults;
  const standardVarMappings = pickBy(varMappings, (_, key) => !isCustomFieldId(key));

  return Object.keys(standardVarMappings).length ? { ...rest, varMappings: standardVarMappings } : rest;
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function restoreCustomOverrideRules(current: FieldConfigSource, old: FieldConfigSource): FieldConfigSource {
  const result = {
    defaults: {
      ...current.defaults,
      custom: old.defaults.custom,
    },
    overrides: [...current.overrides],
  };

  // Expressions for custom options belong to the custom config, so they're restored with it
  const varMappings = {
    ...pickBy(current.defaults.varMappings, (_, key) => !isCustomFieldId(key)),
    ...pickBy(old.defaults.varMappings, (_, key) => isCustomFieldId(key)),
  };
  if (Object.keys(varMappings).length) {
    result.defaults.varMappings = varMappings;
  } else {
    delete result.defaults.varMappings;
  }

  for (const override of old.overrides) {
    for (const prop of override.properties) {
      if (isCustomFieldProp(prop)) {
        const currentOverride = result.overrides.find((o) => isEqual(o.matcher, override.matcher));
        if (currentOverride) {
          if (currentOverride !== override) {
            currentOverride.properties.push(prop);
          }
        } else {
          result.overrides.push(override);
        }
      }
    }
  }

  return result;
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function isCustomFieldProp(prop: DynamicConfigValue): boolean {
  // An expression for a custom option is part of the custom config too
  return isCustomFieldId(isVarMappingProp(prop) ? unwrapVarMappingPropId(prop.id) : prop.id);
}

function isCustomFieldId(id: string): boolean {
  return id.startsWith('custom.');
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function isStandardFieldProp(prop: DynamicConfigValue): boolean {
  return !isCustomFieldProp(prop);
}

const VAR_MAPPING_PROP_PREFIX = 'varMappings.';

/**
 * True for a `varMappings.<id>` override entry, which holds the expression for property `<id>`
 * in the same rule.
 * Used internally, not intended for external use.
 * @internal
 */
export function isVarMappingProp(prop: DynamicConfigValue): boolean {
  return prop.id.startsWith(VAR_MAPPING_PROP_PREFIX);
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function unwrapVarMappingPropId(id: string): string {
  return id.slice(VAR_MAPPING_PROP_PREFIX.length);
}

/**
 * Used internally, not intended for external use.
 * @internal
 */
export function wrapVarMappingPropId(id: string): string {
  return `${VAR_MAPPING_PROP_PREFIX}${id}`;
}
