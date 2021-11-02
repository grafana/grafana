import { __values } from "tslib";
import { MappingType } from '@grafana/data';
import { isArray } from 'lodash';
// This is called when the panel changes from another panel
export var timelinePanelChangedHandler = function (panel, prevPluginId, prevOptions) {
    var e_1, _a, e_2, _b, e_3, _c;
    var _d, _e;
    var options = ((_d = panel.options) !== null && _d !== void 0 ? _d : {});
    // Changing from angular singlestat
    if (prevPluginId === 'natel-discrete-panel' && prevOptions.angular) {
        var oldOptions = prevOptions.angular;
        var fieldConfig = (_e = panel.fieldConfig) !== null && _e !== void 0 ? _e : { defaults: {}, overrides: [] };
        if (oldOptions.units) {
            fieldConfig.defaults.unit = oldOptions.units;
        }
        var custom = {
            fillOpacity: 100,
            lineWidth: 0,
        };
        fieldConfig.defaults.custom = custom;
        options.mergeValues = true;
        // Convert mappings
        var valuemap = { type: MappingType.ValueToText, options: {} };
        fieldConfig.defaults.mappings = [valuemap];
        if (isArray(oldOptions.colorMaps)) {
            try {
                for (var _f = __values(oldOptions.colorMaps), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var p = _g.value;
                    var color = p.color;
                    if (color) {
                        valuemap.options[p.text] = { color: color };
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        if (isArray(oldOptions.valueMaps)) {
            try {
                for (var _h = __values(oldOptions.valueMaps), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var p = _j.value;
                    var text = p.text;
                    var value = p.value;
                    if (text && value) {
                        var old = valuemap.options[value];
                        if (old) {
                            old.text = text;
                        }
                        else {
                            valuemap.options[value] = { text: text };
                        }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        if (isArray(oldOptions.rangeMaps)) {
            try {
                for (var _k = __values(oldOptions.rangeMaps), _l = _k.next(); !_l.done; _l = _k.next()) {
                    var p = _l.value;
                    var from = +p.from;
                    var to = +p.to;
                    var text = p.text;
                    if (text) {
                        fieldConfig.defaults.mappings.push({
                            type: MappingType.RangeToText,
                            options: {
                                from: from,
                                to: to,
                                result: { text: text },
                            },
                        });
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
        // mutates the input
        panel.fieldConfig = fieldConfig;
    }
    return options;
};
//# sourceMappingURL=migrations.js.map