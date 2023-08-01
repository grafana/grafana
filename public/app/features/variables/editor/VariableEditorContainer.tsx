import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { SettingsPageProps } from 'app/features/dashboard/components/DashboardSettings/types';

import { StoreState, ThunkDispatch } from '../../../types';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getEditorVariables, getVariablesState } from '../state/selectors';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableEditorEditor } from './VariableEditorEditor';
import { VariableEditorList } from './VariableEditorList';
import { createNewVariable, initListMode } from './actions';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const { uid } = ownProps.dashboard;
  const templatingState = getVariablesState(uid, state);
  return {
    variables: getEditorVariables(uid, state),
    idInEditor: templatingState.editor.id,
    usagesNetwork: templatingState.inspect.usagesNetwork,
    usages: templatingState.inspect.usages,
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {
    ...bindActionCreators({ createNewVariable, initListMode }, dispatch),
    changeVariableOrder: (identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) =>
      dispatch(
        toKeyedAction(
          identifier.rootStateKey,
          changeVariableOrder(toVariablePayload(identifier, { fromIndex, toIndex }))
        )
      ),
    duplicateVariable: (identifier: KeyedVariableIdentifier) =>
      dispatch(
        toKeyedAction(
          identifier.rootStateKey,
          duplicateVariable(toVariablePayload(identifier, { newId: undefined as unknown as string }))
        )
      ),
    removeVariable: (identifier: KeyedVariableIdentifier) => {
      dispatch(
        toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true })))
      );
    },
  };
};

interface OwnProps extends SettingsPageProps {}

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

interface State {
  variableId?: KeyedVariableIdentifier;
}

class VariableEditorContainerUnconnected extends PureComponent<Props, State> {
  state: State = {
    variableId: undefined,
  };

  componentDidMount() {
    this.props.initListMode(this.props.dashboard.uid);
  }

  onEditVariable = (identifier: KeyedVariableIdentifier) => {
    const index = this.props.variables.findIndex((x) => x.id === identifier.id);
    locationService.partial({ editIndex: index });
  };

  onNewVariable = () => {
    this.props.createNewVariable(this.props.dashboard.uid);
  };

  onChangeVariableOrder = (identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(identifier, fromIndex, toIndex);
  };

  onDuplicateVariable = (identifier: KeyedVariableIdentifier) => {
    this.props.duplicateVariable(identifier);
  };

  onModalOpen = (identifier: KeyedVariableIdentifier) => {
    this.setState({ variableId: identifier });
  };

  onModalClose = () => {
    this.setState({ variableId: undefined });
  };

  onRemoveVariable = () => {
    this.props.removeVariable(this.state.variableId!);
    this.onModalClose();
  };

  render() {
    const { editIndex, variables } = this.props;
    const variableToEdit = editIndex != null ? variables[editIndex] : undefined;
    const subPageNav = variableToEdit ? { text: variableToEdit.name } : undefined;

    return (
      <Page navModel={this.props.sectionNav} pageNav={subPageNav}>
        {!variableToEdit && (
          <VariableEditorList
            variables={this.props.variables}
            onAdd={this.onNewVariable}
            onEdit={this.onEditVariable}
            onChangeOrder={this.onChangeVariableOrder}
            onDuplicate={this.onDuplicateVariable}
            onDelete={this.onModalOpen}
            usages={this.props.usages}
            usagesNetwork={this.props.usagesNetwork}
          />
        )}
        {!variableToEdit && this.props.variables.length > 0 && (
          <VariablesUnknownTable variables={this.props.variables} dashboard={this.props.dashboard} />
        )}
        {variableToEdit && <VariableEditorEditor identifier={toKeyedVariableIdentifier(variableToEdit)} />}
        <ConfirmDeleteModal
          isOpen={this.state.variableId !== undefined}
          varName={this.state.variableId?.id ?? ''}
          onConfirm={this.onRemoveVariable}
          onDismiss={this.onModalClose}
        />
      </Page>
    );
  }
}

export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
