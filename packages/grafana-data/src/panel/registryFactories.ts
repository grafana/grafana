import { FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { standardFieldConfigEditorRegistry } from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty, FieldConfigPropertyItem } from '../types/fieldOverrides';
import { FieldConfigEditorBuilder } from '../utils/OptionsUIBuilders';

import { SetFieldConfigOptionsArgs } from './PanelPlugin';

/**
 * Helper functionality to create a field config registry.
 *
 * @param config - configuration to base the registry on.
 * @param pluginName - name of the plugin that will use the registry.
 * @internal
 */
export function createFieldConfigRegistry<TFieldConfigOptions>(
  config: SetFieldConfigOptionsArgs<TFieldConfigOptions> = {},
  pluginName: string
): FieldConfigOptionsRegistry {
  const registry = new FieldConfigOptionsRegistry();
  const standardConfigs = standardFieldConfigEditorRegistry.list();
  const standardOptionsExtensions: Record<string, FieldConfigPropertyItem[]> = {};

  // Add custom options
  if (config.useCustomConfig) {
    const builder = new FieldConfigEditorBuilder<TFieldConfigOptions>();
    config.useCustomConfig(builder);

    for (const customProp of builder.getRegistry().list()) {
      customProp.isCustom = true;
      // need to do something to make the custom items not conflict with standard ones
      // problem is id (registry index) is used as property path
      // so sort of need a property path on the FieldPropertyEditorItem
      customProp.id = 'custom.' + customProp.id;

      if (isStandardConfigExtension(customProp, standardConfigs)) {
        const currentExtensions = standardOptionsExtensions[customProp.category![0]] ?? [];
        currentExtensions.push(customProp);
        standardOptionsExtensions[customProp.category![0]] = currentExtensions;
      } else {
        registry.register(customProp);
      }
    }
  }

  for (let fieldConfigProp of standardConfigs) {
    const id = fieldConfigProp.id as FieldConfigProperty;
    if (config.disableStandardOptions) {
      const isDisabled = config.disableStandardOptions.indexOf(id) > -1;
      if (isDisabled) {
        continue;
      }
    }
    if (config.standardOptions) {
      const customHideFromDefaults = config.standardOptions[id]?.hideFromDefaults;
      const customDefault = config.standardOptions[id]?.defaultValue;
      const customSettings = config.standardOptions[id]?.settings;

      if (customHideFromDefaults !== undefined) {
        fieldConfigProp = {
          ...fieldConfigProp,
          hideFromDefaults: customHideFromDefaults,
        };
      }

      if (customDefault) {
        fieldConfigProp = {
          ...fieldConfigProp,
          defaultValue: customDefault,
        };
      }

      if (customSettings) {
        fieldConfigProp = {
          ...fieldConfigProp,
          settings: fieldConfigProp.settings ? { ...fieldConfigProp.settings, ...customSettings } : customSettings,
        };
      }
    }

    registry.register(fieldConfigProp);

    if (fieldConfigProp.category && standardOptionsExtensions[fieldConfigProp.category[0]]) {
      for (let extensionProperty of standardOptionsExtensions[fieldConfigProp.category[0]]) {
        registry.register(extensionProperty);
      }
    }
  }

  // assert that field configs do not use array path syntax
  for (const item of registry.list()) {
    if (item.path.indexOf('[') > 0) {
      throw new Error(`[${pluginName}] Field config paths do not support arrays: ${item.id}`);
    }
  }

  return registry;
}

function isStandardConfigExtension(property: FieldConfigPropertyItem, standardProperties: FieldConfigPropertyItem[]) {
  return Boolean(
    standardProperties.find((p) => property.category && p.category && property.category[0] === p.category[0])
  );
}
