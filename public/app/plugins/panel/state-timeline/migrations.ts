import { isArray } from 'lodash';

import { FieldConfigSource, MappingType, PanelModel, ValueMap, RangeMap, ValueMapping } from '@grafana/data';

import { FieldConfig, Options } from './panelcfg.gen';

// This is called when the panel changes from another panel
export const timelinePanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  let options: Options = panel.options ?? {};

  // Changing from angular singlestat
  if (prevPluginId === 'natel-discrete-panel' && prevOptions.angular) {
    const oldOptions = prevOptions.angular;
    const fieldConfig: FieldConfigSource = panel.fieldConfig ?? { defaults: {}, overrides: [] };

    if (oldOptions.units) {
      fieldConfig.defaults.unit = oldOptions.units;
    }

    const custom: FieldConfig = {
      fillOpacity: 100,
      lineWidth: 0,
    };
    fieldConfig.defaults.custom = custom;
    options.mergeValues = true;

    // Convert mappings
    const valuemap: ValueMap = { type: MappingType.ValueToText, options: {} };
    fieldConfig.defaults.mappings = [valuemap];

    if (isArray(oldOptions.colorMaps)) {
      for (const p of oldOptions.colorMaps) {
        const color: string = p.color;
        if (color) {
          valuemap.options[p.text] = { color };
        }
      }
    }

    if (isArray(oldOptions.valueMaps)) {
      for (const p of oldOptions.valueMaps) {
        const text: string = p.text;
        const value: string = p.value;
        if (text && value) {
          let old = valuemap.options[value];
          if (old) {
            old.text = text;
          } else {
            valuemap.options[value] = { text };
          }
        }
      }
    }

    if (isArray(oldOptions.rangeMaps)) {
      for (const p of oldOptions.rangeMaps) {
        let from = +p.from;
        let to = +p.to;
        const text: string = p.text;
        if (text) {
          fieldConfig.defaults.mappings.push({
            type: MappingType.RangeToText,
            options: {
              from,
              to,
              result: { text },
            },
          });
        }
      }
    }

    if (fieldConfig.defaults.mappings?.length) {
      fieldConfig.defaults.mappings = expandColorMappings(fieldConfig.defaults.mappings);
    }

    // mutates the input
    panel.fieldConfig = fieldConfig;
  }

  return options;
};

function expandColorMappings(mappings: ValueMapping[]): ValueMapping[] {
  let keyToColor: Record<string, string> = {};
  for (const m of mappings) {
    if (isValueToText(m)) {
      for (const key in m.options) {
        const target = m.options[key];
        if (target.color?.length) {
          keyToColor[key] = target.color;
        }
      }
    } else if (isRangeMap(m)) {
      const { text, color } = m.options.result;
      if (text?.length && color?.length && !keyToColor[text]) {
        keyToColor[text] = color;
      }
    }
  }

  // Set a color for values that match
  return mappings.map((m) => {
    if (isValueToText(m)) {
      for (const key in m.options) {
        const target = m.options[key];
        if (!target.color?.length) {
          let c = keyToColor[key];
          if (!c && target.text) {
            c = keyToColor[target.text];
          }
          if (c) {
            target.color = c; // link the mapped color
          }
        }
      }
    } else if (isRangeMap(m)) {
      const { text, color } = m.options.result;
      if (!color && text && keyToColor[text]) {
        m.options.result.color = keyToColor[text];
      }
    }
    return m;
  });
}

function isValueToText(m: ValueMapping): m is ValueMap {
  return m.type === MappingType.ValueToText;
}

function isRangeMap(m: ValueMapping): m is RangeMap {
  return m.type === MappingType.RangeToText;
}
