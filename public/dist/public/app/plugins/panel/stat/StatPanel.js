import { __extends, __values } from "tslib";
import React, { PureComponent } from 'react';
import { BigValue, BigValueGraphMode, DataLinksContextMenu, VizRepeater, BigValueTextMode, } from '@grafana/ui';
import { FieldType, getDisplayValueAlignmentFactors, getFieldDisplayValues, } from '@grafana/data';
import { config } from 'app/core/config';
import { findNumericFieldMinMax } from '@grafana/data/src/field/fieldOverrides';
import { isNumber } from 'lodash';
var StatPanel = /** @class */ (function (_super) {
    __extends(StatPanel, _super);
    function StatPanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderComponent = function (valueProps, menuProps) {
            var _a = _this.props, timeRange = _a.timeRange, options = _a.options;
            var value = valueProps.value, alignmentFactors = valueProps.alignmentFactors, width = valueProps.width, height = valueProps.height, count = valueProps.count;
            var openMenu = menuProps.openMenu, targetClassName = menuProps.targetClassName;
            var sparkline = value.sparkline;
            if (sparkline) {
                sparkline.timeRange = timeRange;
            }
            return (React.createElement(BigValue, { value: value.display, count: count, sparkline: sparkline, colorMode: options.colorMode, graphMode: options.graphMode, justifyMode: options.justifyMode, textMode: _this.getTextMode(), alignmentFactors: alignmentFactors, text: options.text, width: width, height: height, theme: config.theme2, onClick: openMenu, className: targetClassName }));
        };
        _this.renderValue = function (valueProps) {
            var value = valueProps.value;
            var getLinks = value.getLinks, hasLinks = value.hasLinks;
            if (hasLinks && getLinks) {
                return (React.createElement(DataLinksContextMenu, { links: getLinks, config: value.field }, function (api) {
                    return _this.renderComponent(valueProps, api);
                }));
            }
            return _this.renderComponent(valueProps, {});
        };
        _this.getValues = function () {
            var e_1, _a, e_2, _b;
            var _c, _d, _e, _f;
            var _g = _this.props, data = _g.data, options = _g.options, replaceVariables = _g.replaceVariables, fieldConfig = _g.fieldConfig, timeZone = _g.timeZone;
            var globalRange = undefined;
            try {
                for (var _h = __values(data.series), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var frame = _j.value;
                    try {
                        for (var _k = (e_2 = void 0, __values(frame.fields)), _l = _k.next(); !_l.done; _l = _k.next()) {
                            var field = _l.value;
                            var config_1 = field.config;
                            // mostly copied from fieldOverrides, since they are skipped during streaming
                            // Set the Min/Max value automatically
                            if (field.type === FieldType.number) {
                                if ((_c = field.state) === null || _c === void 0 ? void 0 : _c.range) {
                                    continue;
                                }
                                if (!globalRange && (!isNumber(config_1.min) || !isNumber(config_1.max))) {
                                    globalRange = findNumericFieldMinMax(data.series);
                                }
                                var min = (_d = config_1.min) !== null && _d !== void 0 ? _d : globalRange.min;
                                var max = (_e = config_1.max) !== null && _e !== void 0 ? _e : globalRange.max;
                                field.state = (_f = field.state) !== null && _f !== void 0 ? _f : {};
                                field.state.range = { min: min, max: max, delta: max - min };
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_l && !_l.done && (_b = _k.return)) _b.call(_k);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_a = _h.return)) _a.call(_h);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return getFieldDisplayValues({
                fieldConfig: fieldConfig,
                reduceOptions: options.reduceOptions,
                replaceVariables: replaceVariables,
                theme: config.theme2,
                data: data.series,
                sparkline: options.graphMode !== BigValueGraphMode.None,
                timeZone: timeZone,
            });
        };
        return _this;
    }
    StatPanel.prototype.getTextMode = function () {
        var _a = this.props, options = _a.options, fieldConfig = _a.fieldConfig, title = _a.title;
        // If we have manually set displayName or panel title switch text mode to value and name
        if (options.textMode === BigValueTextMode.Auto && (fieldConfig.defaults.displayName || !title)) {
            return BigValueTextMode.ValueAndName;
        }
        return options.textMode;
    };
    StatPanel.prototype.render = function () {
        var _a = this.props, height = _a.height, options = _a.options, width = _a.width, data = _a.data, renderCounter = _a.renderCounter;
        return (React.createElement(VizRepeater, { getValues: this.getValues, getAlignmentFactors: getDisplayValueAlignmentFactors, renderValue: this.renderValue, width: width, height: height, source: data, itemSpacing: 3, renderCounter: renderCounter, autoGrid: true, orientation: options.orientation }));
    };
    return StatPanel;
}(PureComponent));
export { StatPanel };
//# sourceMappingURL=StatPanel.js.map