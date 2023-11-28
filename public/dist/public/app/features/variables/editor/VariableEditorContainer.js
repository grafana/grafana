import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { config, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getEditorVariables, getVariablesState } from '../state/selectors';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableEditorEditor } from './VariableEditorEditor';
import { VariableEditorList } from './VariableEditorList';
import { createNewVariable, initListMode } from './actions';
const mapStateToProps = (state, ownProps) => {
    const { uid } = ownProps.dashboard;
    const templatingState = getVariablesState(uid, state);
    return {
        variables: getEditorVariables(uid, state),
        idInEditor: templatingState.editor.id,
        usagesNetwork: templatingState.inspect.usagesNetwork,
        usages: templatingState.inspect.usages,
    };
};
const mapDispatchToProps = (dispatch) => {
    return Object.assign(Object.assign({}, bindActionCreators({ createNewVariable, initListMode }, dispatch)), { changeVariableOrder: (identifier, fromIndex, toIndex) => dispatch(toKeyedAction(identifier.rootStateKey, changeVariableOrder(toVariablePayload(identifier, { fromIndex, toIndex })))), duplicateVariable: (identifier) => dispatch(toKeyedAction(identifier.rootStateKey, duplicateVariable(toVariablePayload(identifier, { newId: undefined })))), removeVariable: (identifier) => {
            dispatch(toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true }))));
        } });
};
const connector = connect(mapStateToProps, mapDispatchToProps);
class VariableEditorContainerUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            variableId: undefined,
        };
        this.onEditVariable = (identifier) => {
            const index = this.props.variables.findIndex((x) => x.id === identifier.id);
            locationService.partial({ editIndex: index });
        };
        this.onNewVariable = () => {
            this.props.createNewVariable(this.props.dashboard.uid);
        };
        this.onChangeVariableOrder = (identifier, fromIndex, toIndex) => {
            this.props.changeVariableOrder(identifier, fromIndex, toIndex);
        };
        this.onDuplicateVariable = (identifier) => {
            this.props.duplicateVariable(identifier);
        };
        this.onModalOpen = (identifier) => {
            this.setState({ variableId: identifier });
        };
        this.onModalClose = () => {
            this.setState({ variableId: undefined });
        };
        this.onRemoveVariable = () => {
            this.props.removeVariable(this.state.variableId);
            this.onModalClose();
        };
    }
    componentDidMount() {
        this.props.initListMode(this.props.dashboard.uid);
    }
    render() {
        var _a, _b;
        const { editIndex, variables, sectionNav } = this.props;
        const variableToEdit = editIndex != null ? variables[editIndex] : undefined;
        const node = sectionNav.node;
        const parentItem = config.featureToggles.dockedMegaMenu && node.parentItem
            ? Object.assign(Object.assign({}, node.parentItem), { url: node.url }) : undefined;
        const subPageNav = variableToEdit ? { text: variableToEdit.name, parentItem } : parentItem;
        return (React.createElement(Page, { navModel: this.props.sectionNav, pageNav: subPageNav },
            !variableToEdit && (React.createElement(VariableEditorList, { variables: this.props.variables, onAdd: this.onNewVariable, onEdit: this.onEditVariable, onChangeOrder: this.onChangeVariableOrder, onDuplicate: this.onDuplicateVariable, onDelete: this.onModalOpen, usages: this.props.usages, usagesNetwork: this.props.usagesNetwork })),
            !variableToEdit && this.props.variables.length > 0 && (React.createElement(VariablesUnknownTable, { variables: this.props.variables, dashboard: this.props.dashboard })),
            variableToEdit && React.createElement(VariableEditorEditor, { identifier: toKeyedVariableIdentifier(variableToEdit) }),
            React.createElement(ConfirmDeleteModal, { isOpen: this.state.variableId !== undefined, varName: (_b = (_a = this.state.variableId) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '', onConfirm: this.onRemoveVariable, onDismiss: this.onModalClose })));
    }
}
export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
//# sourceMappingURL=VariableEditorContainer.js.map