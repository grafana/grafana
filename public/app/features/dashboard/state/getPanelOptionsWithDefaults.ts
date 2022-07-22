import { mergeWith, isArray, isObject, unset, isEqual } from 'lodash';

import {
  ConfigOverrideRule,
  DynamicConfigValue,
  FieldColorConfigSettings,
  FieldColorModeId,
  fieldColorModeRegistry,
  FieldConfigOptionsRegistry,
  FieldConfigProperty,
  FieldConfigSource,
  PanelPlugin,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';

export interface Props {
  plugin: PanelPlugin;
  currentFieldConfig: FieldConfigSource;
  currentOptions: Record<string, any>;
  isAfterPluginChange: boolean;
}

export interface OptionDefaults {
  options: any;
  fieldConfig: FieldConfigSource;
}

export function getPanelOptionsWithDefaults({
  plugin,
  currentOptions,
  currentFieldConfig,
  isAfterPluginChange,
}: Props): OptionDefaults {
  const optionsWithDefaults = mergeWith(
    {},
    plugin.defaults,
    currentOptions || {},
    (objValue: any, srcValue: any): any => {
      if (isArray(srcValue)) {
        return srcValue;
      }
    }
  );

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
      (objValue: any, srcValue: any): any => {
        if (isArray(srcValue)) {
          return srcValue;
        }
      }
    ),
    overrides: existingFieldConfig?.overrides ?? [],
  };

  cleanProperties(result.defaults, '', plugin.fieldConfigRegistry);

  // Thresholds base values are null in JSON but need to be converted to -Infinity
  if (result.defaults.thresholds) {
    fixThresholds(result.defaults.thresholds);
  }

  // Filter out overrides for properties that cannot be found in registry
  result.overrides = filterFieldConfigOverrides(result.overrides, (prop) => {
    return plugin.fieldConfigRegistry.getIfExists(prop.id) !== undefined;
  });

  for (const override of result.overrides) {
    for (const property of override.properties) {
      if (property.id === 'thresholds') {
        fixThresholds(property.value as ThresholdsConfig);
      }
    }
  }

  return result;
}

export function filterFieldConfigOverrides(
  overrides: ConfigOverrideRule[],
  condition: (value: DynamicConfigValue) => boolean
): ConfigOverrideRule[] {
  return overrides
    .map((x) => {
      const properties = x.properties.filter(condition);

      return {
        ...x,
        properties,
      };
    })
    .filter((x) => x.properties.length > 0);
}

function cleanProperties(obj: any, parentPath: string, fieldConfigRegistry: FieldConfigOptionsRegistry) {
  let found = false;

  for (const propName of Object.keys(obj)) {
    const value = obj[propName];
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
    const colorSettings = color.settings as FieldColorConfigSettings;
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

export function restoreCustomOverrideRules(current: FieldConfigSource, old: FieldConfigSource): FieldConfigSource {
  const result = {
    defaults: {
      ...current.defaults,
      custom: old.defaults.custom,
    },
    overrides: [...current.overrides],
  };

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

export function isCustomFieldProp(prop: DynamicConfigValue): boolean {
  return prop.id.startsWith('custom.');
}

export function isStandardFieldProp(prop: DynamicConfigValue): boolean {
  return !isCustomFieldProp(prop);
}
