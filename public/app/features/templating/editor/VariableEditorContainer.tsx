import React, { MouseEvent, PureComponent } from 'react';
import { emptyUuid, VariableState } from '../state/types';
import { StoreState } from '../../../types';
import { e2e } from '@grafana/e2e';
import { VariableEditorList } from './VariableEditorList';
import { VariableEditorEditor } from './VariableEditorEditor';
import {
  changeToEditorEditMode,
  changeToEditorListMode,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  toPayload,
  VariableIdentifier,
} from '../state/actions';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { getVariableStates } from '../state/selectors';

interface OwnProps {}

interface ConnectedProps {
  uuidInEditor: string | null;
  variableStates: VariableState[];
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
    this.props.changeToEditorListMode(toPayload({ uuid: null, type: 'query' }));
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorListMode(toPayload({ uuid: null, type: 'query' }));
  };

  onEditVariable = (identifier: VariableIdentifier) => {
    this.props.changeToEditorEditMode(toPayload({ uuid: identifier.uuid, type: identifier.type }));
  };

  onChangeToAddMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorEditMode(toPayload({ uuid: emptyUuid, type: 'query' }));
  };

  onChangeVariableOrder = (identifier: VariableIdentifier, fromIndex: number, toIndex: number) => {
    this.props.changeVariableOrder(toPayload(identifier, { fromIndex, toIndex }));
  };

  onDuplicateVariable = (identifier: VariableIdentifier) => {
    this.props.duplicateVariable(toPayload(identifier));
  };

  onRemoveVariable = (identifier: VariableIdentifier) => {
    this.props.removeVariable(toPayload(identifier));
  };

  render() {
    const variableStateToEdit =
      this.props.variableStates.find(s => s.variable.uuid === this.props.uuidInEditor) ?? null;
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
          {this.props.variableStates.length > 0 && variableStateToEdit === null && (
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

        {!variableStateToEdit && (
          <VariableEditorList
            variableStates={this.props.variableStates}
            onAddClick={this.onChangeToAddMode}
            onEditClick={this.onEditVariable}
            onChangeVariableOrder={this.onChangeVariableOrder}
            onDuplicateVariable={this.onDuplicateVariable}
            onRemoveVariable={this.onRemoveVariable}
          />
        )}
        {variableStateToEdit && (
          <VariableEditorEditor
            picker={variableStateToEdit.picker}
            editor={variableStateToEdit.editor}
            variable={variableStateToEdit.variable}
          />
        )}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  variableStates: getVariableStates(state),
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
