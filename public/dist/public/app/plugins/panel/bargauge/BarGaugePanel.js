import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { getDisplayValueAlignmentFactors, getFieldDisplayValues, } from '@grafana/data';
import { BarGauge, DataLinksContextMenu, VizRepeater } from '@grafana/ui';
import { config } from 'app/core/config';
import { isNumber } from 'lodash';
var BarGaugePanel = /** @class */ (function (_super) {
    __extends(BarGaugePanel, _super);
    function BarGaugePanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderComponent = function (valueProps, menuProps) {
            var _a = _this.props, options = _a.options, fieldConfig = _a.fieldConfig;
            var value = valueProps.value, alignmentFactors = valueProps.alignmentFactors, orientation = valueProps.orientation, width = valueProps.width, height = valueProps.height, count = valueProps.count;
            var field = value.field, display = value.display, view = value.view, colIndex = value.colIndex;
            var openMenu = menuProps.openMenu, targetClassName = menuProps.targetClassName;
            var processor = undefined;
            if (view && isNumber(colIndex)) {
                processor = view.getFieldDisplayProcessor(colIndex);
            }
            return (React.createElement(BarGauge, { value: clearNameForSingleSeries(count, fieldConfig.defaults, display), width: width, height: height, orientation: orientation, field: field, text: options.text, display: processor, theme: config.theme2, itemSpacing: _this.getItemSpacing(), displayMode: options.displayMode, onClick: openMenu, className: targetClassName, alignmentFactors: count > 1 ? alignmentFactors : undefined, showUnfilled: options.showUnfilled }));
        };
        _this.renderValue = function (valueProps) {
            var value = valueProps.value;
            var hasLinks = value.hasLinks, getLinks = value.getLinks;
            if (hasLinks && getLinks) {
                return (React.createElement(DataLinksContextMenu, { links: getLinks, config: value.field }, function (api) {
                    return _this.renderComponent(valueProps, api);
                }));
            }
            return _this.renderComponent(valueProps, {});
        };
        _this.getValues = function () {
            var _a = _this.props, data = _a.data, options = _a.options, replaceVariables = _a.replaceVariables, fieldConfig = _a.fieldConfig, timeZone = _a.timeZone;
            return getFieldDisplayValues({
                fieldConfig: fieldConfig,
                reduceOptions: options.reduceOptions,
                replaceVariables: replaceVariables,
                theme: config.theme2,
                data: data.series,
                timeZone: timeZone,
            });
        };
        return _this;
    }
    BarGaugePanel.prototype.getItemSpacing = function () {
        if (this.props.options.displayMode === 'lcd') {
            return 2;
        }
        return 10;
    };
    BarGaugePanel.prototype.render = function () {
        var _a = this.props, height = _a.height, width = _a.width, options = _a.options, data = _a.data, renderCounter = _a.renderCounter;
        return (React.createElement(VizRepeater, { source: data, getAlignmentFactors: getDisplayValueAlignmentFactors, getValues: this.getValues, renderValue: this.renderValue, renderCounter: renderCounter, width: width, height: height, minVizHeight: 10, itemSpacing: this.getItemSpacing(), orientation: options.orientation }));
    };
    return BarGaugePanel;
}(PureComponent));
export { BarGaugePanel };
export function clearNameForSingleSeries(count, field, display) {
    if (count === 1 && !field.displayName) {
        return __assign(__assign({}, display), { title: undefined });
    }
    return display;
}
//# sourceMappingURL=BarGaugePanel.js.map