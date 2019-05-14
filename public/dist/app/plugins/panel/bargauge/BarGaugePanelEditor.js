import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { ThresholdsEditor, ValueMappingsEditor, PanelOptionsGrid, PanelOptionsGroup, FormField } from '@grafana/ui';
// Types
import { FormLabel, Select } from '@grafana/ui';
import { orientationOptions } from './types';
import { SingleStatValueEditor } from '../singlestat2/SingleStatValueEditor';
var BarGaugePanelEditor = /** @class */ (function (_super) {
    tslib_1.__extends(BarGaugePanelEditor, _super);
    function BarGaugePanelEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onThresholdsChanged = function (thresholds) {
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { thresholds: thresholds }));
        };
        _this.onValueMappingsChanged = function (valueMappings) {
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { valueMappings: valueMappings }));
        };
        _this.onValueOptionsChanged = function (valueOptions) {
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { valueOptions: valueOptions }));
        };
        _this.onMinValueChange = function (_a) {
            var target = _a.target;
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { minValue: target.value }));
        };
        _this.onMaxValueChange = function (_a) {
            var target = _a.target;
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { maxValue: target.value }));
        };
        _this.onOrientationChange = function (_a) {
            var value = _a.value;
            return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { orientation: value }));
        };
        return _this;
    }
    BarGaugePanelEditor.prototype.render = function () {
        var options = this.props.options;
        return (React.createElement(React.Fragment, null,
            React.createElement(PanelOptionsGrid, null,
                React.createElement(SingleStatValueEditor, { onChange: this.onValueOptionsChanged, options: options.valueOptions }),
                React.createElement(PanelOptionsGroup, { title: "Gauge" },
                    React.createElement(FormField, { label: "Min value", labelWidth: 8, onChange: this.onMinValueChange, value: options.minValue }),
                    React.createElement(FormField, { label: "Max value", labelWidth: 8, onChange: this.onMaxValueChange, value: options.maxValue }),
                    React.createElement("div", { className: "form-field" },
                        React.createElement(FormLabel, { width: 8 }, "Orientation"),
                        React.createElement(Select, { width: 12, options: orientationOptions, defaultValue: orientationOptions[0], onChange: this.onOrientationChange, value: orientationOptions.find(function (item) { return item.value === options.orientation; }) }))),
                React.createElement(ThresholdsEditor, { onChange: this.onThresholdsChanged, thresholds: options.thresholds })),
            React.createElement(ValueMappingsEditor, { onChange: this.onValueMappingsChanged, valueMappings: options.valueMappings })));
    };
    return BarGaugePanelEditor;
}(PureComponent));
export { BarGaugePanelEditor };
//# sourceMappingURL=BarGaugePanelEditor.js.map