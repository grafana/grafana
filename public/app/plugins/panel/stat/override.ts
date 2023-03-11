import { FieldDisplay, FieldConfigEditorBuilder, InterpolateFunction, GrafanaTheme2 } from '@grafana/data';

import { PanelFieldConfig } from './panelcfg.gen';

export function addDisplayOverrideOptions(builder: FieldConfigEditorBuilder<PanelFieldConfig>) {
  const category = ['Override display'];
  const hideFromDefaults = true; // ???
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
    const display = { ...disp.display }; // ?? avoid check if any exist first?
    if (cfg.prefix?.length) {
      display.prefix = replace(cfg.prefix);
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
    if (changed) {
      return { ...disp, display };
    }
  }
  return disp;
}
