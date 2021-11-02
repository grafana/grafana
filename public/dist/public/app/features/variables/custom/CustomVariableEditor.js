import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { VerticalGroup } from '@grafana/ui';
import { changeVariableMultiValue } from '../state/actions';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';
var CustomVariableEditorUnconnected = /** @class */ (function (_super) {
    __extends(CustomVariableEditorUnconnected, _super);
    function CustomVariableEditorUnconnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChange = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
            });
        };
        _this.onSelectionOptionsChange = function (_a) {
            var propName = _a.propName, propValue = _a.propValue;
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_b) {
                    this.props.onPropChange({ propName: propName, propValue: propValue, updateOptions: true });
                    return [2 /*return*/];
                });
            });
        };
        _this.onBlur = function (event) {
            _this.props.onPropChange({
                propName: 'query',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        return _this;
    }
    CustomVariableEditorUnconnected.prototype.render = function () {
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Custom options" }),
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(VerticalGroup, { spacing: "none" },
                    React.createElement(VariableTextAreaField, { name: "Values separated by comma", value: this.props.variable.query, placeholder: "1, 10, mykey : myvalue, myvalue, escaped\\,value", onChange: this.onChange, onBlur: this.onBlur, required: true, width: 50, labelWidth: 27 })),
                React.createElement(SelectionOptionsEditor, { variable: this.props.variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: this.props.changeVariableMultiValue }),
                ' ')));
    };
    return CustomVariableEditorUnconnected;
}(PureComponent));
var mapStateToProps = function (state, ownProps) { return ({}); };
var mapDispatchToProps = {
    changeVariableMultiValue: changeVariableMultiValue,
};
export var CustomVariableEditor = connectWithStore(CustomVariableEditorUnconnected, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=CustomVariableEditor.js.map