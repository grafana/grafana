import { FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { standardFieldConfigEditorRegistry } from '../field/standardFieldConfigEditorRegistry';
import { FieldConfigProperty } from '../types/fieldOverrides';
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
      registry.register(customProp);
    }
  }

  for (let fieldConfigProp of standardFieldConfigEditorRegistry.list()) {
    if (config.disableStandardOptions) {
      const isDisabled = config.disableStandardOptions.indexOf(fieldConfigProp.id as FieldConfigProperty) > -1;
      if (isDisabled) {
        continue;
      }
    }
    if (config.standardOptions) {
      const customDefault: any = config.standardOptions[fieldConfigProp.id as FieldConfigProperty]?.defaultValue;
      const customSettings: any = config.standardOptions[fieldConfigProp.id as FieldConfigProperty]?.settings;
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
  }

  return registry;
}
