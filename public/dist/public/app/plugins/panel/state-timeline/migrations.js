import { isArray } from 'lodash';
import { MappingType } from '@grafana/data';
// This is called when the panel changes from another panel
export const timelinePanelChangedHandler = (panel, prevPluginId, prevOptions) => {
    var _a, _b;
    let options = (_a = panel.options) !== null && _a !== void 0 ? _a : {};
    // Changing from angular singlestat
    if (prevPluginId === 'natel-discrete-panel' && prevOptions.angular) {
        const oldOptions = prevOptions.angular;
        const fieldConfig = (_b = panel.fieldConfig) !== null && _b !== void 0 ? _b : { defaults: {}, overrides: [] };
        if (oldOptions.units) {
            fieldConfig.defaults.unit = oldOptions.units;
        }
        const custom = {
            fillOpacity: 100,
            lineWidth: 0,
        };
        fieldConfig.defaults.custom = custom;
        options.mergeValues = true;
        // Convert mappings
        const valuemap = { type: MappingType.ValueToText, options: {} };
        fieldConfig.defaults.mappings = [valuemap];
        if (isArray(oldOptions.colorMaps)) {
            for (const p of oldOptions.colorMaps) {
                const color = p.color;
                if (color) {
                    valuemap.options[p.text] = { color };
                }
            }
        }
        if (isArray(oldOptions.valueMaps)) {
            for (const p of oldOptions.valueMaps) {
                const text = p.text;
                const value = p.value;
                if (text && value) {
                    let old = valuemap.options[value];
                    if (old) {
                        old.text = text;
                    }
                    else {
                        valuemap.options[value] = { text };
                    }
                }
            }
        }
        if (isArray(oldOptions.rangeMaps)) {
            for (const p of oldOptions.rangeMaps) {
                let from = +p.from;
                let to = +p.to;
                const text = p.text;
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
//# sourceMappingURL=migrations.js.map