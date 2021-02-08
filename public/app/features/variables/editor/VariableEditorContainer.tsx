import React, { MouseEvent, PureComponent } from 'react';
import { Icon } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { StoreState } from '../../../types';
import { VariableEditorEditor } from './VariableEditorEditor';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { getEditorVariables } from '../state/selectors';
import { VariableModel } from '../types';
import { switchToEditMode, switchToListMode, switchToNewMode } from './actions';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { VariableEditorList } from './VariableEditorList';
import { DashboardModel } from '../../dashboard/state';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';

interface OwnProps {}

interface ConnectedProps {
  idInEditor: string | null;
  variables: VariableModel[];
  dashboard: DashboardModel | null;
}

interface DispatchProps {
  changeVariableOrder: typeof changeVariableOrder;
  duplicateVariable: typeof duplicateVariable;
  removeVariable: typeof removeVariable;
  switchToNewMode: typeof switchToNewMode;
  switchToEditMode: typeof switchToEditMode;
  switchToListMode: typeof switchToListMode;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class VariableEditorContainerUnconnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.switchToListMode();
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.switchToListMode();
  };

  onEditVariable = (identifier: VariableIdentifier) => {
    this.props.switchToEditMode(identifier);
  };

  onNewVariable = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.switchToNewMode();
  };

  onChangeVariableOrder = (identifier: VariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(toVariablePayload(identifier, { fromIndex, toIndex }));
  };

  onDuplicateVariable = (identifier: VariableIdentifier) => {
    this.props.duplicateVariable(toVariablePayload(identifier, { newId: (undefined as unknown) as string }));
  };

  onRemoveVariable = (identifier: VariableIdentifier) => {
    this.props.removeVariable(toVariablePayload(identifier, { reIndex: true }));
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
                <Icon
                  name="angle-right"
                  aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.modeLabelEdit}
                />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.props.variables.length > 0 && variableToEdit === null && (
            <>
              <VariablesDependenciesButton variables={this.props.variables} />
              <a
                type="button"
                className="btn btn-primary"
                onClick={this.onNewVariable}
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
              >
                New
              </a>
            </>
          )}
        </div>

        {!variableToEdit && (
          <>
            <VariableEditorList
              dashboard={this.props.dashboard}
              variables={this.props.variables}
              onAddClick={this.onNewVariable}
              onEditClick={this.onEditVariable}
              onChangeVariableOrder={this.onChangeVariableOrder}
              onDuplicateVariable={this.onDuplicateVariable}
              onRemoveVariable={this.onRemoveVariable}
            />
            <VariablesUnknownTable dashboard={this.props.dashboard} variables={this.props.variables} />
          </>
        )}
        {variableToEdit && <VariableEditorEditor identifier={toVariableIdentifier(variableToEdit)} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => ({
  variables: getEditorVariables(state),
  idInEditor: state.templating.editor.id,
  dashboard: state.dashboard.getModel(),
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  switchToNewMode,
  switchToEditMode,
  switchToListMode,
};

export const VariableEditorContainer = connect(mapStateToProps, mapDispatchToProps)(VariableEditorContainerUnconnected);
