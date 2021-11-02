import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Icon, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { VariableEditorEditor } from './VariableEditorEditor';
import { connect } from 'react-redux';
import { getEditorVariables } from '../state/selectors';
import { switchToEditMode, switchToListMode, switchToNewMode } from './actions';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { VariableEditorList } from './VariableEditorList';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
var mapStateToProps = function (state) { return ({
    variables: getEditorVariables(state),
    idInEditor: state.templating.editor.id,
    dashboard: state.dashboard.getModel(),
    unknownsNetwork: state.templating.inspect.unknownsNetwork,
    unknownExists: state.templating.inspect.unknownExits,
    usagesNetwork: state.templating.inspect.usagesNetwork,
    unknown: state.templating.inspect.unknown,
    usages: state.templating.inspect.usages,
}); };
var mapDispatchToProps = {
    changeVariableOrder: changeVariableOrder,
    duplicateVariable: duplicateVariable,
    removeVariable: removeVariable,
    switchToNewMode: switchToNewMode,
    switchToEditMode: switchToEditMode,
    switchToListMode: switchToListMode,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var VariableEditorContainerUnconnected = /** @class */ (function (_super) {
    __extends(VariableEditorContainerUnconnected, _super);
    function VariableEditorContainerUnconnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChangeToListMode = function (event) {
            event.preventDefault();
            _this.props.switchToListMode();
        };
        _this.onEditVariable = function (identifier) {
            _this.props.switchToEditMode(identifier);
        };
        _this.onNewVariable = function (event) {
            event.preventDefault();
            _this.props.switchToNewMode();
        };
        _this.onChangeVariableOrder = function (identifier, fromIndex, toIndex) {
            _this.props.changeVariableOrder(toVariablePayload(identifier, { fromIndex: fromIndex, toIndex: toIndex }));
        };
        _this.onDuplicateVariable = function (identifier) {
            _this.props.duplicateVariable(toVariablePayload(identifier, { newId: undefined }));
        };
        _this.onRemoveVariable = function (identifier) {
            _this.props.removeVariable(toVariablePayload(identifier, { reIndex: true }));
        };
        return _this;
    }
    VariableEditorContainerUnconnected.prototype.componentDidMount = function () {
        this.props.switchToListMode();
    };
    VariableEditorContainerUnconnected.prototype.render = function () {
        var _this = this;
        var _a;
        var variableToEdit = (_a = this.props.variables.find(function (s) { return s.id === _this.props.idInEditor; })) !== null && _a !== void 0 ? _a : null;
        return (React.createElement("div", null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("h3", { className: "dashboard-settings__header" },
                    React.createElement("a", { onClick: this.onChangeToListMode, "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.General.headerLink }, "Variables"),
                    this.props.idInEditor && (React.createElement("span", null,
                        React.createElement(Icon, { name: "angle-right" }),
                        "Edit"))),
                React.createElement("div", { className: "page-action-bar__spacer" }),
                this.props.variables.length > 0 && variableToEdit === null && (React.createElement(React.Fragment, null,
                    React.createElement(VariablesDependenciesButton, { variables: this.props.variables }),
                    React.createElement(LinkButton, { type: "button", onClick: this.onNewVariable, "aria-label": selectors.pages.Dashboard.Settings.Variables.List.newButton }, "New")))),
            !variableToEdit && (React.createElement(React.Fragment, null,
                React.createElement(VariableEditorList, { dashboard: this.props.dashboard, variables: this.props.variables, onAddClick: this.onNewVariable, onEditClick: this.onEditVariable, onChangeVariableOrder: this.onChangeVariableOrder, onDuplicateVariable: this.onDuplicateVariable, onRemoveVariable: this.onRemoveVariable, usages: this.props.usages, usagesNetwork: this.props.usagesNetwork }),
                this.props.unknownExists ? React.createElement(VariablesUnknownTable, { usages: this.props.unknownsNetwork }) : null)),
            variableToEdit && React.createElement(VariableEditorEditor, { identifier: toVariableIdentifier(variableToEdit) })));
    };
    return VariableEditorContainerUnconnected;
}(PureComponent));
export var VariableEditorContainer = connector(VariableEditorContainerUnconnected);
//# sourceMappingURL=VariableEditorContainer.js.map