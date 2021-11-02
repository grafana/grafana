import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { isEqual } from 'lodash';
import { AppEvents, LoadingState } from '@grafana/data';
import { Button, Icon, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { variableAdapters } from '../adapters';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { appEvents } from '../../../core/core';
import { VariableValuesPreview } from './VariableValuesPreview';
import { changeVariableName, onEditorUpdate, variableEditorMount, variableEditorUnMount } from './actions';
import { getVariable } from '../state/selectors';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { changeVariableProp, changeVariableType } from '../state/sharedReducer';
import { updateOptions } from '../state/actions';
import { VariableTextField } from './VariableTextField';
import { VariableSectionHeader } from './VariableSectionHeader';
import { hasOptions } from '../guard';
import { VariableTypeSelect } from './VariableTypeSelect';
import { VariableHideSelect } from './VariableHideSelect';
var VariableEditorEditorUnConnected = /** @class */ (function (_super) {
    __extends(VariableEditorEditorUnConnected, _super);
    function VariableEditorEditorUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onNameChange = function (event) {
            event.preventDefault();
            _this.props.changeVariableName(_this.props.identifier, event.currentTarget.value);
        };
        _this.onTypeChange = function (option) {
            if (!option.value) {
                return;
            }
            _this.props.changeVariableType(toVariablePayload(_this.props.identifier, { newType: option.value }));
        };
        _this.onLabelChange = function (event) {
            event.preventDefault();
            _this.props.changeVariableProp(toVariablePayload(_this.props.identifier, { propName: 'label', propValue: event.currentTarget.value }));
        };
        _this.onDescriptionChange = function (event) {
            _this.props.changeVariableProp(toVariablePayload(_this.props.identifier, { propName: 'description', propValue: event.currentTarget.value }));
        };
        _this.onHideChange = function (option) {
            _this.props.changeVariableProp(toVariablePayload(_this.props.identifier, {
                propName: 'hide',
                propValue: option.value,
            }));
        };
        _this.onPropChanged = function (_a) {
            var propName = _a.propName, propValue = _a.propValue, _b = _a.updateOptions, updateOptions = _b === void 0 ? false : _b;
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            this.props.changeVariableProp(toVariablePayload(this.props.identifier, { propName: propName, propValue: propValue }));
                            if (!updateOptions) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.props.updateOptions(toVariableIdentifier(this.props.variable))];
                        case 1:
                            _c.sent();
                            _c.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        };
        _this.onHandleSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        event.preventDefault();
                        if (!this.props.editor.isValid) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.props.onEditorUpdate(this.props.identifier)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    VariableEditorEditorUnConnected.prototype.componentDidMount = function () {
        this.props.variableEditorMount(this.props.identifier);
    };
    VariableEditorEditorUnConnected.prototype.componentDidUpdate = function (prevProps, prevState, snapshot) {
        if (!isEqual(prevProps.editor.errors, this.props.editor.errors)) {
            Object.values(this.props.editor.errors).forEach(function (error) {
                appEvents.emit(AppEvents.alertWarning, ['Validation', error]);
            });
        }
    };
    VariableEditorEditorUnConnected.prototype.componentWillUnmount = function () {
        this.props.variableEditorUnMount(this.props.identifier);
    };
    VariableEditorEditorUnConnected.prototype.render = function () {
        var _a, _b;
        var variable = this.props.variable;
        var EditorToRender = variableAdapters.get(this.props.variable.type).editor;
        if (!EditorToRender) {
            return null;
        }
        var loading = variable.state === LoadingState.Loading;
        return (React.createElement("div", null,
            React.createElement("form", { "aria-label": "Variable editor Form", onSubmit: this.onHandleSubmit },
                React.createElement(VerticalGroup, { spacing: "lg" },
                    React.createElement(VerticalGroup, { spacing: "none" },
                        React.createElement(VariableSectionHeader, { name: "General" }),
                        React.createElement(InlineFieldRow, null,
                            React.createElement(VariableTextField, { value: this.props.editor.name, onChange: this.onNameChange, name: "Name", placeholder: "name", required: true, ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput }),
                            React.createElement(VariableTypeSelect, { onChange: this.onTypeChange, type: this.props.variable.type })),
                        this.props.editor.errors.name && (React.createElement("div", { className: "gf-form" },
                            React.createElement("span", { className: "gf-form-label gf-form-label--error" }, this.props.editor.errors.name))),
                        React.createElement(InlineFieldRow, null,
                            React.createElement(VariableTextField, { value: (_a = this.props.variable.label) !== null && _a !== void 0 ? _a : '', onChange: this.onLabelChange, name: "Label", placeholder: "optional display name", ariaLabel: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput }),
                            React.createElement(VariableHideSelect, { onChange: this.onHideChange, hide: this.props.variable.hide, type: this.props.variable.type })),
                        React.createElement(VariableTextField, { name: "Description", value: (_b = variable.description) !== null && _b !== void 0 ? _b : '', placeholder: "descriptive text", onChange: this.onDescriptionChange, grow: true })),
                    EditorToRender && React.createElement(EditorToRender, { variable: this.props.variable, onPropChange: this.onPropChanged }),
                    hasOptions(this.props.variable) ? React.createElement(VariableValuesPreview, { variable: this.props.variable }) : null,
                    React.createElement(VerticalGroup, { spacing: "none" },
                        React.createElement(Button, { type: "submit", "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton, disabled: loading },
                            "Update",
                            loading ? (React.createElement(Icon, { className: "spin-clockwise", name: "sync", size: "sm", style: { marginLeft: '2px' } })) : null))))));
    };
    return VariableEditorEditorUnConnected;
}(PureComponent));
export { VariableEditorEditorUnConnected };
var mapStateToProps = function (state, ownProps) { return ({
    editor: state.templating.editor,
    variable: getVariable(ownProps.identifier.id, state, false), // we could be renaming a variable and we don't want this to throw
}); };
var mapDispatchToProps = {
    variableEditorMount: variableEditorMount,
    variableEditorUnMount: variableEditorUnMount,
    changeVariableName: changeVariableName,
    changeVariableProp: changeVariableProp,
    onEditorUpdate: onEditorUpdate,
    changeVariableType: changeVariableType,
    updateOptions: updateOptions,
};
export var VariableEditorEditor = connectWithStore(VariableEditorEditorUnConnected, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=VariableEditorEditor.js.map