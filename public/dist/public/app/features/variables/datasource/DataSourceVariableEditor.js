import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { initDataSourceVariableEditor } from './actions';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { changeVariableMultiValue } from '../state/actions';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
var DataSourceVariableEditorUnConnected = /** @class */ (function (_super) {
    __extends(DataSourceVariableEditorUnConnected, _super);
    function DataSourceVariableEditorUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onRegExChange = function (event) {
            _this.props.onPropChange({
                propName: 'regex',
                propValue: event.currentTarget.value,
            });
        };
        _this.onRegExBlur = function (event) {
            _this.props.onPropChange({
                propName: 'regex',
                propValue: event.currentTarget.value,
                updateOptions: true,
            });
        };
        _this.onSelectionOptionsChange = function (_a) {
            var propValue = _a.propValue, propName = _a.propName;
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_b) {
                    this.props.onPropChange({ propName: propName, propValue: propValue, updateOptions: true });
                    return [2 /*return*/];
                });
            });
        };
        _this.getSelectedDataSourceTypeValue = function () {
            var _a, _b, _c, _d;
            if (!((_b = (_a = _this.props.editor.extended) === null || _a === void 0 ? void 0 : _a.dataSourceTypes) === null || _b === void 0 ? void 0 : _b.length)) {
                return '';
            }
            var foundItem = (_c = _this.props.editor.extended) === null || _c === void 0 ? void 0 : _c.dataSourceTypes.find(function (ds) { return ds.value === _this.props.variable.query; });
            var value = foundItem ? foundItem.value : (_d = _this.props.editor.extended) === null || _d === void 0 ? void 0 : _d.dataSourceTypes[0].value;
            return value !== null && value !== void 0 ? value : '';
        };
        _this.onDataSourceTypeChanged = function (option) {
            _this.props.onPropChange({ propName: 'query', propValue: option.value, updateOptions: true });
        };
        return _this;
    }
    DataSourceVariableEditorUnConnected.prototype.componentDidMount = function () {
        this.props.initDataSourceVariableEditor();
    };
    DataSourceVariableEditorUnConnected.prototype.render = function () {
        var _this = this;
        var _a, _b, _c, _d, _e;
        var typeOptions = ((_b = (_a = this.props.editor.extended) === null || _a === void 0 ? void 0 : _a.dataSourceTypes) === null || _b === void 0 ? void 0 : _b.length)
            ? (_d = (_c = this.props.editor.extended) === null || _c === void 0 ? void 0 : _c.dataSourceTypes) === null || _d === void 0 ? void 0 : _d.map(function (ds) { var _a; return ({ value: (_a = ds.value) !== null && _a !== void 0 ? _a : '', label: ds.text }); })
            : [];
        var typeValue = (_e = typeOptions.find(function (o) { return o.value === _this.props.variable.query; })) !== null && _e !== void 0 ? _e : typeOptions[0];
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Data source options" }),
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(VerticalGroup, { spacing: "xs" },
                    React.createElement(InlineFieldRow, null,
                        React.createElement(VariableSelectField, { name: "Type", value: typeValue, options: typeOptions, onChange: this.onDataSourceTypeChanged, labelWidth: 10 })),
                    React.createElement(InlineFieldRow, null,
                        React.createElement(VariableTextField, { value: this.props.variable.regex, name: "Instance name filter", placeholder: "/.*-(.*)-.*/", onChange: this.onRegExChange, onBlur: this.onRegExBlur, labelWidth: 20, tooltip: React.createElement("div", null,
                                "Regex filter for which data source instances to choose from in the variable value list. Leave empty for all.",
                                React.createElement("br", null),
                                React.createElement("br", null),
                                "Example: ",
                                React.createElement("code", null, "/^prod/")) }))),
                React.createElement(SelectionOptionsEditor, { variable: this.props.variable, onPropChange: this.onSelectionOptionsChange, onMultiChanged: this.props.changeVariableMultiValue }))));
    };
    return DataSourceVariableEditorUnConnected;
}(PureComponent));
export { DataSourceVariableEditorUnConnected };
var mapStateToProps = function (state, ownProps) { return ({
    editor: state.templating.editor,
}); };
var mapDispatchToProps = {
    initDataSourceVariableEditor: initDataSourceVariableEditor,
    changeVariableMultiValue: changeVariableMultiValue,
};
export var DataSourceVariableEditor = connectWithStore(DataSourceVariableEditorUnConnected, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=DataSourceVariableEditor.js.map