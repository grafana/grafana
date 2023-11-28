import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { hasOptions } from '../guard';
import { updateOptions } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../state/selectors';
import { changeVariableProp, changeVariableType, removeVariable } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableHideSelect } from './VariableHideSelect';
import { VariableLegend } from './VariableLegend';
import { VariableTextAreaField } from './VariableTextAreaField';
import { VariableTextField } from './VariableTextField';
import { VariableTypeSelect } from './VariableTypeSelect';
import { VariableValuesPreview } from './VariableValuesPreview';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { VariableNameConstraints } from './types';
const mapStateToProps = (state, ownProps) => ({
    editor: getVariablesState(ownProps.identifier.rootStateKey, state).editor,
    variable: getVariable(ownProps.identifier, state),
});
const mapDispatchToProps = (dispatch) => {
    return Object.assign(Object.assign({}, bindActionCreators({ variableEditorMount, variableEditorUnMount, changeVariableName, updateOptions }, dispatch)), { changeVariableProp: (identifier, propName, propValue) => dispatch(toKeyedAction(identifier.rootStateKey, changeVariableProp(toVariablePayload(identifier, { propName, propValue })))), changeVariableType: (identifier, newType) => dispatch(toKeyedAction(identifier.rootStateKey, changeVariableType(toVariablePayload(identifier, { newType })))), removeVariable: (identifier) => {
            dispatch(toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true }))));
        } });
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export class VariableEditorEditorUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            showDeleteModal: false,
        };
        this.onNameChange = (event) => {
            event.preventDefault();
            this.props.changeVariableName(this.props.identifier, event.currentTarget.value);
        };
        this.onTypeChange = (option) => {
            if (!option.value) {
                return;
            }
            this.props.changeVariableType(this.props.identifier, option.value);
        };
        this.onLabelChange = (event) => {
            event.preventDefault();
            this.props.changeVariableProp(this.props.identifier, 'label', event.currentTarget.value);
        };
        this.onDescriptionChange = (event) => {
            this.props.changeVariableProp(this.props.identifier, 'description', event.currentTarget.value);
        };
        this.onHideChange = (option) => {
            this.props.changeVariableProp(this.props.identifier, 'hide', option);
        };
        this.onPropChanged = ({ propName, propValue, updateOptions = false }) => {
            this.props.changeVariableProp(this.props.identifier, propName, propValue);
            if (updateOptions) {
                this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
            }
        };
        this.onHandleSubmit = (event) => __awaiter(this, void 0, void 0, function* () {
            event.preventDefault();
            if (!this.props.editor.isValid) {
                return;
            }
            this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
        });
        this.onModalOpen = () => {
            this.setState({ showDeleteModal: true });
        };
        this.onModalClose = () => {
            this.setState({ showDeleteModal: false });
        };
        this.onDelete = () => {
            this.props.removeVariable(this.props.identifier);
            this.onModalClose();
            locationService.partial({ editIndex: null });
        };
        this.onApply = () => {
            locationService.partial({ editIndex: null });
        };
    }
    componentDidMount() {
        this.props.variableEditorMount(this.props.identifier);
    }
    componentWillUnmount() {
        this.props.variableEditorUnMount(this.props.identifier);
    }
    render() {
        var _a, _b;
        const { variable } = this.props;
        const EditorToRender = variableAdapters.get(this.props.variable.type).editor;
        if (!EditorToRender) {
            return null;
        }
        const loading = variable.state === LoadingState.Loading;
        return (React.createElement(React.Fragment, null,
            React.createElement("form", { "aria-label": "Variable editor Form", onSubmit: this.onHandleSubmit },
                React.createElement(VariableTypeSelect, { onChange: this.onTypeChange, type: this.props.variable.type }),
                React.createElement(VariableLegend, null, "General"),
                React.createElement(VariableTextField, { value: this.props.editor.name, onChange: this.onNameChange, name: "Name", placeholder: "Variable name", description: "The name of the template variable. (Max. 50 characters)", invalid: !!this.props.editor.errors.name, error: this.props.editor.errors.name, testId: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2, maxLength: VariableNameConstraints.MaxSize, required: true }),
                React.createElement(VariableTextField, { name: "Label", description: "Optional display name", value: (_a = this.props.variable.label) !== null && _a !== void 0 ? _a : '', placeholder: "Label name", onChange: this.onLabelChange, testId: selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2 }),
                React.createElement(VariableTextAreaField, { name: "Description", value: (_b = variable.description) !== null && _b !== void 0 ? _b : '', placeholder: "Descriptive text", onChange: this.onDescriptionChange, width: 52 }),
                React.createElement(VariableHideSelect, { onChange: this.onHideChange, hide: this.props.variable.hide, type: this.props.variable.type }),
                EditorToRender && React.createElement(EditorToRender, { variable: this.props.variable, onPropChange: this.onPropChanged }),
                hasOptions(this.props.variable) ? React.createElement(VariableValuesPreview, { variable: this.props.variable }) : null,
                React.createElement("div", { style: { marginTop: '16px' } },
                    React.createElement(HorizontalGroup, { spacing: "md", height: "inherit" },
                        React.createElement(Button, { variant: "destructive", fill: "outline", onClick: this.onModalOpen }, "Delete"),
                        React.createElement(Button, { type: "submit", "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton, disabled: loading, variant: "secondary" },
                            "Run query",
                            loading && React.createElement(Icon, { className: "spin-clockwise", name: "sync", size: "sm", style: { marginLeft: '2px' } })),
                        React.createElement(Button, { variant: "primary", onClick: this.onApply, "data-testid": selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton }, "Apply")))),
            React.createElement(ConfirmDeleteModal, { isOpen: this.state.showDeleteModal, varName: this.props.editor.name, onConfirm: this.onDelete, onDismiss: this.onModalClose })));
    }
}
export const VariableEditorEditor = connector(VariableEditorEditorUnConnected);
//# sourceMappingURL=VariableEditorEditor.js.map