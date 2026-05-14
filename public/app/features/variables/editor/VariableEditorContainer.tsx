import { memo, useEffect, useState } from 'react';
import { connect, type ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { type SettingsPageProps } from 'app/features/dashboard/components/DashboardSettings/types';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getEditorVariables, getVariablesState } from '../state/selectors';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { type KeyedVariableIdentifier } from '../state/types';
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

const VariableEditorContainerUnconnected = memo(function VariableEditorContainerUnconnected({
  dashboard,
  editIndex,
  variables,
  sectionNav,
  usages,
  usagesNetwork,
  initListMode,
  createNewVariable,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
}: Props) {
  const [variableId, setVariableId] = useState<KeyedVariableIdentifier | undefined>(undefined);

  useEffect(() => {
    initListMode(dashboard.uid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onEditVariable(identifier: KeyedVariableIdentifier) {
    const index = variables.findIndex((x) => x.id === identifier.id);
    locationService.partial({ editIndex: index });
  }

  function onNewVariable() {
    createNewVariable(dashboard.uid);
  }

  function onChangeVariableOrder(identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) {
    changeVariableOrder(identifier, fromIndex, toIndex);
  }

  function onDuplicateVariable(identifier: KeyedVariableIdentifier) {
    duplicateVariable(identifier);
  }

  function onModalOpen(identifier: KeyedVariableIdentifier) {
    setVariableId(identifier);
  }

  function onModalClose() {
    setVariableId(undefined);
  }

  function onRemoveVariable() {
    removeVariable(variableId!);
    onModalClose();
  }

  const variableToEdit = editIndex != null ? variables[editIndex] : undefined;
  const node = sectionNav.node;
  const parentItem = node.parentItem;
  const subPageNav = variableToEdit ? { text: variableToEdit.name, parentItem } : parentItem;

  return (
    <Page navModel={sectionNav} pageNav={subPageNav}>
      {!variableToEdit && (
        <VariableEditorList
          variables={variables}
          onAdd={onNewVariable}
          onEdit={onEditVariable}
          onChangeOrder={onChangeVariableOrder}
          onDuplicate={onDuplicateVariable}
          onDelete={onModalOpen}
          usages={usages}
          usagesNetwork={usagesNetwork}
        />
      )}
      {!variableToEdit && variables.length > 0 && <VariablesUnknownTable variables={variables} dashboard={dashboard} />}
      {variableToEdit && <VariableEditorEditor identifier={toKeyedVariableIdentifier(variableToEdit)} />}
      <ConfirmDeleteModal
        isOpen={variableId !== undefined}
        varName={variableId?.id ?? ''}
        onConfirm={onRemoveVariable}
        onDismiss={onModalClose}
      />
    </Page>
  );
});

export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
