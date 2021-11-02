import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Alert, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { changeVariableDatasource, initAdHocVariableEditor } from './actions';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
var mapStateToProps = function (state) { return ({
    editor: state.templating.editor,
}); };
var mapDispatchToProps = {
    initAdHocVariableEditor: initAdHocVariableEditor,
    changeVariableDatasource: changeVariableDatasource,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var AdHocVariableEditorUnConnected = /** @class */ (function (_super) {
    __extends(AdHocVariableEditorUnConnected, _super);
    function AdHocVariableEditorUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onDatasourceChanged = function (option) {
            _this.props.changeVariableDatasource(option.value);
        };
        return _this;
    }
    AdHocVariableEditorUnConnected.prototype.componentDidMount = function () {
        this.props.initAdHocVariableEditor();
    };
    AdHocVariableEditorUnConnected.prototype.render = function () {
        var _a, _b, _c, _d, _e;
        var _f = this.props, variable = _f.variable, editor = _f.editor;
        var dataSources = (_b = (_a = editor.extended) === null || _a === void 0 ? void 0 : _a.dataSources) !== null && _b !== void 0 ? _b : [];
        var infoText = (_d = (_c = editor.extended) === null || _c === void 0 ? void 0 : _c.infoText) !== null && _d !== void 0 ? _d : null;
        var options = dataSources.map(function (ds) { return ({ label: ds.text, value: { uid: ds.value } }); });
        var value = (_e = options.find(function (o) { return o.value === variable.datasource; })) !== null && _e !== void 0 ? _e : options[0];
        return (React.createElement(VerticalGroup, { spacing: "xs" },
            React.createElement(VariableSectionHeader, { name: "Options" }),
            React.createElement(VerticalGroup, { spacing: "sm" },
                React.createElement(InlineFieldRow, null,
                    React.createElement(VariableSelectField, { name: "Data source", value: value, options: options, onChange: this.onDatasourceChanged, labelWidth: 10 })),
                infoText ? React.createElement(Alert, { title: infoText, severity: "info" }) : null)));
    };
    return AdHocVariableEditorUnConnected;
}(PureComponent));
export { AdHocVariableEditorUnConnected };
export var AdHocVariableEditor = connector(AdHocVariableEditorUnConnected);
//# sourceMappingURL=AdHocVariableEditor.js.map