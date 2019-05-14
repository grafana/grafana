import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { Switch, PanelOptionsGroup } from '@grafana/ui';
// Types
import { FormField } from '@grafana/ui';
var GaugeOptionsBox = /** @class */ (function (_super) {
    tslib_1.__extends(GaugeOptionsBox, _super);
    function GaugeOptionsBox() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.labelWidth = 8;
        _this.onToggleThresholdLabels = function () {
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { showThresholdLabels: !_this.props.options.showThresholdLabels }));
        };
        _this.onToggleThresholdMarkers = function () {
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { showThresholdMarkers: !_this.props.options.showThresholdMarkers }));
        };
        _this.onMinValueChange = function (_a) {
            var target = _a.target;
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { minValue: target.value }));
        };
        _this.onMaxValueChange = function (_a) {
            var target = _a.target;
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { maxValue: target.value }));
        };
        return _this;
    }
    GaugeOptionsBox.prototype.render = function () {
        var options = this.props.options;
        var maxValue = options.maxValue, minValue = options.minValue, showThresholdLabels = options.showThresholdLabels, showThresholdMarkers = options.showThresholdMarkers;
        return (React.createElement(PanelOptionsGroup, { title: "Gauge" },
            React.createElement(FormField, { label: "Min value", labelWidth: this.labelWidth, onChange: this.onMinValueChange, value: minValue }),
            React.createElement(FormField, { label: "Max value", labelWidth: this.labelWidth, onChange: this.onMaxValueChange, value: maxValue }),
            React.createElement(Switch, { label: "Show labels", labelClass: "width-" + this.labelWidth, checked: showThresholdLabels, onChange: this.onToggleThresholdLabels }),
            React.createElement(Switch, { label: "Show markers", labelClass: "width-" + this.labelWidth, checked: showThresholdMarkers, onChange: this.onToggleThresholdMarkers })));
    };
    return GaugeOptionsBox;
}(PureComponent));
export { GaugeOptionsBox };
//# sourceMappingURL=GaugeOptionsBox.js.map