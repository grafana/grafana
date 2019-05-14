import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { ThresholdsEditor, PanelOptionsGrid, ValueMappingsEditor, } from '@grafana/ui';
import { GaugeOptionsBox } from './GaugeOptionsBox';
import { SingleStatValueEditor } from '../singlestat2/SingleStatValueEditor';
var GaugePanelEditor = /** @class */ (function (_super) {
    tslib_1.__extends(GaugePanelEditor, _super);
    function GaugePanelEditor() {
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
        return _this;
    }
    GaugePanelEditor.prototype.render = function () {
        var _a = this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
        return (React.createElement(React.Fragment, null,
            React.createElement(PanelOptionsGrid, null,
                React.createElement(SingleStatValueEditor, { onChange: this.onValueOptionsChanged, options: options.valueOptions }),
                React.createElement(GaugeOptionsBox, { onOptionsChange: onOptionsChange, options: options }),
                React.createElement(ThresholdsEditor, { onChange: this.onThresholdsChanged, thresholds: options.thresholds })),
            React.createElement(ValueMappingsEditor, { onChange: this.onValueMappingsChanged, valueMappings: options.valueMappings })));
    };
    return GaugePanelEditor;
}(PureComponent));
export { GaugePanelEditor };
//# sourceMappingURL=GaugePanelEditor.js.map