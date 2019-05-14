import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { ThresholdsEditor, PanelOptionsGrid, ValueMappingsEditor, } from '@grafana/ui';
import { SingleStatValueEditor } from './SingleStatValueEditor';
var SingleStatEditor = /** @class */ (function (_super) {
    tslib_1.__extends(SingleStatEditor, _super);
    function SingleStatEditor() {
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
    SingleStatEditor.prototype.render = function () {
        var options = this.props.options;
        return (React.createElement(React.Fragment, null,
            React.createElement(PanelOptionsGrid, null,
                React.createElement(SingleStatValueEditor, { onChange: this.onValueOptionsChanged, options: options.valueOptions }),
                React.createElement(ThresholdsEditor, { onChange: this.onThresholdsChanged, thresholds: options.thresholds })),
            React.createElement(ValueMappingsEditor, { onChange: this.onValueMappingsChanged, valueMappings: options.valueMappings })));
    };
    return SingleStatEditor;
}(PureComponent));
export { SingleStatEditor };
//# sourceMappingURL=SingleStatEditor.js.map