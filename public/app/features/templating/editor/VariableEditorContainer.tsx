import React, { MouseEvent, PureComponent } from 'react';
import { emptyUuid, VariableState } from '../state/types';
import { StoreState } from '../../../types';
import { e2e } from '@grafana/e2e';
import { VariableEditorList } from './VariableEditorList';
import { VariableEditorEditor } from './VariableEditorEditor';
import {
  changeToEditorEditMode,
  changeToEditorListMode,
  toVariablePayload,
  VariableIdentifier,
} from '../state/actions';
import { VariableModel } from '../variable';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';

interface OwnProps {}

interface ConnectedProps {
  uuidInEditor: string | null;
  variableStates: VariableState[];
}

interface DispatchProps {
  changeToEditorListMode: typeof changeToEditorListMode;
  changeToEditorEditMode: typeof changeToEditorEditMode;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class VariableEditorContainerUnconnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.changeToEditorListMode(toVariablePayload({ uuid: null, type: 'query' } as VariableModel));
  }

  onChangeToListMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorListMode(toVariablePayload({ uuid: null, type: 'query' } as VariableModel));
  };

  onEditVariable = (identifier: VariableIdentifier) => {
    this.props.changeToEditorEditMode(
      toVariablePayload({ uuid: identifier.uuid, type: identifier.type } as VariableModel)
    );
  };

  onChangeToAddMode = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.changeToEditorEditMode(toVariablePayload({ uuid: emptyUuid, type: 'query' } as VariableModel));
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
  variableStates: Object.values(state.templating.variables),
  uuidInEditor: state.templating.uuidInEditor,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changeToEditorListMode,
  changeToEditorEditMode,
};

export const VariableEditorContainer = connectWithStore(
  VariableEditorContainerUnconnected,
  mapStateToProps,
  mapDispatchToProps
);
