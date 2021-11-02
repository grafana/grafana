import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { getFieldDisplayValues } from '@grafana/data';
import { DataLinksContextMenu, Gauge, VizRepeater } from '@grafana/ui';
import { config } from 'app/core/config';
import { clearNameForSingleSeries } from '../bargauge/BarGaugePanel';
var GaugePanel = /** @class */ (function (_super) {
    __extends(GaugePanel, _super);
    function GaugePanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderComponent = function (valueProps, menuProps) {
            var _a = _this.props, options = _a.options, fieldConfig = _a.fieldConfig;
            var width = valueProps.width, height = valueProps.height, count = valueProps.count, value = valueProps.value;
            var field = value.field, display = value.display;
            var openMenu = menuProps.openMenu, targetClassName = menuProps.targetClassName;
            return (React.createElement(Gauge, { value: clearNameForSingleSeries(count, fieldConfig.defaults, display), width: width, height: height, field: field, text: options.text, showThresholdLabels: options.showThresholdLabels, showThresholdMarkers: options.showThresholdMarkers, theme: config.theme, onClick: openMenu, className: targetClassName }));
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
    GaugePanel.prototype.render = function () {
        var _a = this.props, height = _a.height, width = _a.width, data = _a.data, renderCounter = _a.renderCounter, options = _a.options;
        return (React.createElement(VizRepeater, { getValues: this.getValues, renderValue: this.renderValue, width: width, height: height, source: data, autoGrid: true, renderCounter: renderCounter, orientation: options.orientation }));
    };
    return GaugePanel;
}(PureComponent));
export { GaugePanel };
//# sourceMappingURL=GaugePanel.js.map