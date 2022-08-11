import { isArray } from 'lodash';

import { FieldConfigSource, MappingType, PanelModel, ValueMap } from '@grafana/data';

import { TimelineFieldConfig, TimelineOptions } from './types';

// This is called when the panel changes from another panel
export const timelinePanelChangedHandler = (
  panel: PanelModel<Partial<TimelineOptions>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  let options = (panel.options ?? {}) as TimelineOptions;

  // Changing from angular singlestat
  if (prevPluginId === 'natel-discrete-panel' && prevOptions.angular) {
    const oldOptions = prevOptions.angular;
    const fieldConfig: FieldConfigSource = panel.fieldConfig ?? { defaults: {}, overrides: [] };

    if (oldOptions.units) {
      fieldConfig.defaults.unit = oldOptions.units;
    }

    const custom: TimelineFieldConfig = {
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
        const color = p.color as string;
        if (color) {
          valuemap.options[p.text as string] = { color };
        }
      }
    }

    if (isArray(oldOptions.valueMaps)) {
      for (const p of oldOptions.valueMaps) {
        const text = p.text as string;
        const value = p.value as string;
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
        const text = p.text as string;
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

    // mutates the input
    panel.fieldConfig = fieldConfig;
  }

  return options;
};
