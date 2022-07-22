import React, { MouseEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Icon } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { StoreState, ThunkDispatch } from '../../../types';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getEditorVariables, getVariablesState } from '../state/selectors';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { VariableEditorEditor } from './VariableEditorEditor';
import { VariableEditorList } from './VariableEditorList';
import { switchToEditMode, switchToListMode, switchToNewMode } from './actions';

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
    ...bindActionCreators({ switchToNewMode, switchToEditMode, switchToListMode }, dispatch),
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

interface OwnProps {
  dashboard: DashboardModel;
}

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

class VariableEditorContainerUnconnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.switchToListMode(this.props.dashboard.uid);
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.switchToListMode(this.props.dashboard.uid);
  };

  onEditVariable = (identifier: KeyedVariableIdentifier) => {
    this.props.switchToEditMode(identifier);
  };

  onNewVariable = () => {
    this.props.switchToNewMode(this.props.dashboard.uid);
  };

  onChangeVariableOrder = (identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(identifier, fromIndex, toIndex);
  };

  onDuplicateVariable = (identifier: KeyedVariableIdentifier) => {
    this.props.duplicateVariable(identifier);
  };

  onRemoveVariable = (identifier: KeyedVariableIdentifier) => {
    this.props.removeVariable(identifier);
  };

  render() {
    const variableToEdit = this.props.variables.find((s) => s.id === this.props.idInEditor) ?? null;

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="dashboard-settings__header">
            <a
              onClick={this.onChangeToListMode}
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.headerLink}
            >
              Variables
            </a>
            {this.props.idInEditor && (
              <span>
                <Icon name="angle-right" />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.props.variables.length > 0 && variableToEdit === null && (
            <>
              <VariablesDependenciesButton variables={this.props.variables} />
              <Button
                type="button"
                onClick={this.onNewVariable}
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
              >
                New
              </Button>
            </>
          )}
        </div>

        {!variableToEdit && (
          <VariableEditorList
            variables={this.props.variables}
            onAdd={this.onNewVariable}
            onEdit={this.onEditVariable}
            onChangeOrder={this.onChangeVariableOrder}
            onDuplicate={this.onDuplicateVariable}
            onDelete={this.onRemoveVariable}
            usages={this.props.usages}
            usagesNetwork={this.props.usagesNetwork}
          />
        )}
        {!variableToEdit && this.props.variables.length > 0 && (
          <VariablesUnknownTable variables={this.props.variables} dashboard={this.props.dashboard} />
        )}
        {variableToEdit && <VariableEditorEditor identifier={toKeyedVariableIdentifier(variableToEdit)} />}
      </div>
    );
  }
}

export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
