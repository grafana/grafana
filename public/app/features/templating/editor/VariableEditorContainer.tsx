import React, { MouseEvent, PureComponent } from 'react';
import { emptyUuid } from '../state/types';
import { StoreState } from '../../../types';
import { e2e } from '@grafana/e2e';
import { VariableEditorList } from './VariableEditorList';
import { VariableEditorEditor } from './VariableEditorEditor';
import {
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  toVariableIdentifier,
  toVariablePayload,
  VariableIdentifier,
} from '../state/actions';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { getVariableClones } from '../state/selectors';
import { changeToEditorEditMode, changeToEditorListMode } from '../state/uuidInEditorReducer';
import { VariableModel } from '../variable';

interface OwnProps {}

interface ConnectedProps {
  uuidInEditor: string | null;
  variables: VariableModel[];
}

interface DispatchProps {
  changeToEditorListMode: typeof changeToEditorListMode;
  changeToEditorEditMode: typeof changeToEditorEditMode;
  changeVariableOrder: typeof changeVariableOrder;
  duplicateVariable: typeof duplicateVariable;
  removeVariable: typeof removeVariable;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class VariableEditorContainerUnconnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.changeToEditorListMode();
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorListMode();
  };

  onEditVariable = (identifier: VariableIdentifier) => {
    this.props.changeToEditorEditMode(toVariablePayload({ uuid: identifier.uuid, type: identifier.type }));
  };

  onChangeToAddMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorEditMode(toVariablePayload({ uuid: emptyUuid, type: 'query' }));
  };

  onChangeVariableOrder = (identifier: VariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(toVariablePayload(identifier, { fromIndex, toIndex }));
  };

  onDuplicateVariable = (identifier: VariableIdentifier) => {
    this.props.duplicateVariable(toVariablePayload(identifier));
  };

  onRemoveVariable = (identifier: VariableIdentifier) => {
    this.props.removeVariable(toVariablePayload(identifier));
  };

  render() {
    const variableToEdit = this.props.variables.find(s => s.uuid === this.props.uuidInEditor) ?? null;
    return (
      <div>
        <div className="page-action-bar">
          <h3 className="dashboard-settings__header">
            <a
              onClick={this.onChangeToListMode}
              aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.headerLink}
            >
              Variables
            </a>
            {this.props.uuidInEditor === emptyUuid && (
              <span>
                <i
                  className="fa fa-fw fa-chevron-right"
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelNew}
                />
                New
              </span>
            )}
            {this.props.uuidInEditor && this.props.uuidInEditor !== emptyUuid && (
              <span>
                <i
                  className="fa fa-fw fa-chevron-right"
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.modeLabelEdit}
                />
                Edit
              </span>
            )}
          </h3>

          <div className="page-action-bar__spacer" />
          {this.props.variables.length > 0 && variableToEdit === null && (
            <a
              type="button"
              className="btn btn-primary"
              onClick={this.onChangeToAddMode}
              aria-label={e2e.pages.Dashboard.Settings.Variables.List.selectors.newButton}
            >
              New
            </a>
          )}
        </div>

        {!variableToEdit && (
          <VariableEditorList
            variables={this.props.variables}
            onAddClick={this.onChangeToAddMode}
            onEditClick={this.onEditVariable}
            onChangeVariableOrder={this.onChangeVariableOrder}
            onDuplicateVariable={this.onDuplicateVariable}
            onRemoveVariable={this.onRemoveVariable}
          />
        )}
        {variableToEdit && <VariableEditorEditor identifier={toVariableIdentifier(variableToEdit)} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  variables: getVariableClones(state, true),
  uuidInEditor: state.templating.uuidInEditor,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changeToEditorListMode,
  changeToEditorEditMode,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
};

export const VariableEditorContainer = connectWithStore(
  VariableEditorContainerUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
