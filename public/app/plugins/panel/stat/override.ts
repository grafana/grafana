import { FieldDisplay, FieldConfigEditorBuilder, InterpolateFunction, GrafanaTheme2 } from '@grafana/data';

import { PanelFieldConfig } from './panelcfg.gen';

export function addDisplayOverrideOptions(builder: FieldConfigEditorBuilder<PanelFieldConfig>) {
  const category = ['Override display'];
  // This value indicates that the option should not be available in the Field config tab
  const hideFromDefaults = true;
  return builder
    .addTextInput({
      path: 'prefix',
      name: 'Prefix',
      defaultValue: undefined,
      hideFromDefaults,
      settings: {
        placeholder: 'Override prefix',
      },
      category,
    })
    .addTextInput({
      path: 'suffix',
      name: 'Suffix',
      defaultValue: undefined,
      settings: {
        placeholder: 'Override suffix',
      },
      category,
      hideFromDefaults,
    })
    .addTextInput({
      path: 'text',
      name: 'Text',
      defaultValue: undefined,
      settings: {
        placeholder: 'Override text',
      },
      category,
      hideFromDefaults,
    })
    .addColorPicker({
      path: 'color',
      name: 'Color',
      defaultValue: undefined,
      settings: {
        placeholder: 'Custom color',
        isClearable: true,
      },
      category,
      hideFromDefaults,
    });
}

export function applyDisplayOverrides(
  disp: FieldDisplay,
  theme: GrafanaTheme2,
  replace: InterpolateFunction
): FieldDisplay {
  const cfg = disp.field?.custom as PanelFieldConfig;
  if (cfg) {
    let changed = false;
    // Copy the display object
    const display = { ...disp.display };
    // Test for existing display values
    if (cfg.prefix?.length) {
      // Replace all values that exist with the custom config values
      display.prefix = replace(cfg.prefix);
      // Update our `changed` value
      changed = true;
    }
    if (cfg.suffix?.length) {
      display.suffix = replace(cfg.suffix);
      changed = true;
    }
    if (cfg.text?.length) {
      display.text = replace(cfg.text);
      changed = true;
    }
    if (cfg.color?.length) {
      display.color = theme.visualization.getColorByName(cfg.color);
      changed = true;
    }
    // If any changes were made, update the prev display object with the new values
    if (changed) {
      return { ...disp, display };
    }
  }
  return disp;
}
