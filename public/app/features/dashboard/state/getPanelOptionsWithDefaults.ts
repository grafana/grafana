import {
  FieldColorConfigSettings,
  FieldColorModeId,
  fieldColorModeRegistry,
  FieldConfigProperty,
  FieldConfigSource,
  PanelPlugin,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { mergeWith, isArray } from 'lodash';

export interface Props {
  plugin: PanelPlugin;
  currentFieldConfig: FieldConfigSource;
  currentOptions: Record<string, any>;
}

export interface OptionDefaults {
  options: any;
  fieldConfig: FieldConfigSource;
}

export function getPanelOptionsWithDefaults({ plugin, currentOptions, currentFieldConfig }: Props): OptionDefaults {
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

  const fieldConfigWithDefaults = applyFieldConfigDefaults(currentFieldConfig, plugin.fieldConfigDefaults);
  const fieldConfigWithOptimalColorMode = adaptFieldColorMode(plugin, fieldConfigWithDefaults);

  return { options: optionsWithDefaults, fieldConfig: fieldConfigWithOptimalColorMode };
}

function applyFieldConfigDefaults(fieldConfig: FieldConfigSource, defaults: FieldConfigSource): FieldConfigSource {
  const result: FieldConfigSource = {
    defaults: mergeWith(
      {},
      defaults.defaults,
      fieldConfig ? fieldConfig.defaults : {},
      (objValue: any, srcValue: any): any => {
        if (isArray(srcValue)) {
          return srcValue;
        }
      }
    ),
    overrides: fieldConfig?.overrides ?? [],
  };

  // Thresholds base values are null in JSON but need to be converted to -Infinity
  if (result.defaults.thresholds) {
    fixThresholds(result.defaults.thresholds);
  }

  for (const override of result.overrides) {
    for (const property of override.properties) {
      if (property.id === 'thresholds') {
        fixThresholds(property.value as ThresholdsConfig);
      }
    }
  }

  return result;
}

function adaptFieldColorMode(plugin: PanelPlugin, fieldConfig: FieldConfigSource): FieldConfigSource {
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
    if (colorSettings.byValueSupport && colorSettings.preferThresholdsMode) {
      if (!mode || !mode.isByValue) {
        fieldConfig.defaults.color = { mode: FieldColorModeId.Thresholds };
        return fieldConfig;
      }
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
