import React, { MouseEvent, PureComponent } from 'react';
import { Alert, Checkbox, Field, Icon, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { StoreState } from '../../../types';
import { VariableEditorEditor } from './VariableEditorEditor';
import { connect, ConnectedProps } from 'react-redux';
import { getEditorVariables } from '../state/selectors';
import { switchToEditMode, switchToListMode, switchToNewMode } from './actions';
import { changeVariableOrder, duplicateVariable, removeVariable } from '../state/sharedReducer';
import { VariableEditorList } from './VariableEditorList';
import { VariablesUnknownTable } from '../inspect/VariablesUnknownTable';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { setStrictPanelRefresh } from '../settings/reducer';

const mapStateToProps = (state: StoreState) => ({
  variables: getEditorVariables(state),
  idInEditor: state.templating.editor.id,
  dashboard: state.dashboard.getModel(),
  unknownsNetwork: state.templating.inspect.unknownsNetwork,
  unknownExists: state.templating.inspect.unknownExits,
  usagesNetwork: state.templating.inspect.usagesNetwork,
  unknown: state.templating.inspect.unknown,
  usages: state.templating.inspect.usages,
  strictPanelRefreshMode: state.templating.settings.strictPanelRefreshMode,
});

const mapDispatchToProps = {
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  switchToNewMode,
  switchToEditMode,
  switchToListMode,
  setStrictPanelRefresh,
};

interface OwnProps {}

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

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

  onNewVariable = (event: MouseEvent) => {
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
                <Icon name="angle-right" />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.props.variables.length > 0 && variableToEdit === null && (
            <>
              <VariablesDependenciesButton variables={this.props.variables} />
              <LinkButton
                type="button"
                onClick={this.onNewVariable}
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
              >
                New
              </LinkButton>
            </>
          )}
        </div>

        {!variableToEdit && (
          <>
            <Alert title="Strict panel refresh" severity="info">
              <p>
                Using strict panel refresh means only panels that are affected by a variable change will be refreshed.
                The default setting is to refresh all panels when a variable changes.
              </p>
              <p>
                <i>
                  If strict panel refresh setting is used then the data in panels not affected by a variable change
                  might look stale until next refresh.
                </i>
              </p>
            </Alert>
            <Field label="Strict panel refresh">
              <Checkbox
                id="variables-settings-strict-mode"
                value={this.props.strictPanelRefreshMode}
                onChange={(e) => this.props.setStrictPanelRefresh(e.currentTarget.checked)}
              />
            </Field>
            <VariableEditorList
              dashboard={this.props.dashboard}
              variables={this.props.variables}
              onAddClick={this.onNewVariable}
              onEditClick={this.onEditVariable}
              onChangeVariableOrder={this.onChangeVariableOrder}
              onDuplicateVariable={this.onDuplicateVariable}
              onRemoveVariable={this.onRemoveVariable}
              usages={this.props.usages}
              usagesNetwork={this.props.usagesNetwork}
            />
            {this.props.unknownExists ? <VariablesUnknownTable usages={this.props.unknownsNetwork} /> : null}
          </>
        )}
        {variableToEdit && <VariableEditorEditor identifier={toVariableIdentifier(variableToEdit)} />}
      </div>
    );
  }
}

export const VariableEditorContainer = connector(VariableEditorContainerUnconnected);
