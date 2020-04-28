import React, { ChangeEvent, FormEvent, PureComponent } from 'react';
import isEqual from 'lodash/isEqual';
import { AppEvents, VariableType } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { variableAdapters } from '../adapters';
import { NEW_VARIABLE_ID, toVariablePayload, VariableIdentifier } from '../state/types';
import { VariableHide, VariableModel } from '../../templating/types';
import { appEvents } from '../../../core/core';
import { VariableValuesPreview } from './VariableValuesPreview';
import { changeVariableName, onEditorAdd, onEditorUpdate, variableEditorMount, variableEditorUnMount } from './actions';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../types';
import { VariableEditorState } from './reducer';
import { getVariable } from '../state/selectors';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { OnPropChangeArguments } from './types';
import { changeVariableProp, changeVariableType } from '../state/sharedReducer';

export interface OwnProps {
  identifier: VariableIdentifier;
}

interface ConnectedProps {
  editor: VariableEditorState;
  variable: VariableModel;
}

interface DispatchProps {
  variableEditorMount: typeof variableEditorMount;
  variableEditorUnMount: typeof variableEditorUnMount;
  changeVariableName: typeof changeVariableName;
  changeVariableProp: typeof changeVariableProp;
  onEditorUpdate: typeof onEditorUpdate;
  onEditorAdd: typeof onEditorAdd;
  changeVariableType: typeof changeVariableType;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class VariableEditorEditorUnConnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.variableEditorMount(this.props.identifier);
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any): void {
    if (!isEqual(prevProps.editor.errors, this.props.editor.errors)) {
      Object.values(this.props.editor.errors).forEach(error => {
        appEvents.emit(AppEvents.alertWarning, ['Validation', error]);
      });
    }
  }

  componentWillUnmount(): void {
    this.props.variableEditorUnMount(this.props.identifier);
  }

  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableName(this.props.identifier, event.target.value);
  };

  onTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    this.props.changeVariableType(
      toVariablePayload(this.props.identifier, { newType: event.target.value as VariableType })
    );
  };

  onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableProp(
      toVariablePayload(this.props.identifier, { propName: 'label', propValue: event.target.value })
    );
  };

  onHideChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    this.props.changeVariableProp(
      toVariablePayload(this.props.identifier, {
        propName: 'hide',
        propValue: parseInt(event.target.value, 10) as VariableHide,
      })
    );
  };

  onPropChanged = async ({ propName, propValue, updateOptions = false }: OnPropChangeArguments) => {
    this.props.changeVariableProp(toVariablePayload(this.props.identifier, { propName, propValue }));
    if (updateOptions) {
      await variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
    }
  };

  onHandleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!this.props.editor.isValid) {
      return;
    }

    if (this.props.variable.id !== NEW_VARIABLE_ID) {
      await this.props.onEditorUpdate(this.props.identifier);
    }

    if (this.props.variable.id === NEW_VARIABLE_ID) {
      await this.props.onEditorAdd(this.props.identifier);
    }
  };

  render() {
    const EditorToRender = variableAdapters.get(this.props.variable.type).editor;
    if (!EditorToRender) {
      return null;
    }
    const newVariable = this.props.variable.id && this.props.variable.id === NEW_VARIABLE_ID;

    return (
      <div>
        <form aria-label="Variable editor Form" onSubmit={this.onHandleSubmit}>
          <h5 className="section-heading">General</h5>
          <div className="gf-form-group">
            <div className="gf-form-inline">
              <div className="gf-form max-width-19">
                <span className="gf-form-label width-6">Name</span>
                <input
                  type="text"
                  className="gf-form-input"
                  name="name"
                  placeholder="name"
                  required
                  value={this.props.editor.name}
                  onChange={this.onNameChange}
                  aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput}
                />
              </div>
              <div className="gf-form max-width-19">
                <InlineFormLabel width={6} tooltip={variableAdapters.get(this.props.variable.type).description}>
                  Type
                </InlineFormLabel>
                <div className="gf-form-select-wrapper max-width-17">
                  <select
                    className="gf-form-input"
                    value={this.props.variable.type}
                    onChange={this.onTypeChange}
                    aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect}
                  >
                    {variableAdapters.list().map(({ id, name }) => (
                      <option key={id} label={name} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {this.props.editor.errors.name && (
              <div className="gf-form">
                <span className="gf-form-label gf-form-label--error">{this.props.editor.errors.name}</span>
              </div>
            )}

            <div className="gf-form-inline">
              <div className="gf-form max-width-19">
                <span className="gf-form-label width-6">Label</span>
                <input
                  type="text"
                  className="gf-form-input"
                  value={this.props.variable.label ?? ''}
                  onChange={this.onLabelChange}
                  placeholder="optional display name"
                  aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput}
                />
              </div>
              <div className="gf-form max-width-19">
                <span className="gf-form-label width-6">Hide</span>
                <div className="gf-form-select-wrapper max-width-15">
                  <select
                    className="gf-form-input"
                    value={this.props.variable.hide}
                    onChange={this.onHideChange}
                    aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalHideSelect}
                  >
                    <option label="" value={VariableHide.dontHide}>
                      {''}
                    </option>
                    <option label="" value={VariableHide.hideLabel}>
                      Label
                    </option>
                    <option label="" value={VariableHide.hideVariable}>
                      Variable
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {EditorToRender && <EditorToRender variable={this.props.variable} onPropChange={this.onPropChanged} />}

          <VariableValuesPreview variable={this.props.variable} />

          <div className="gf-form-button-row p-y-0">
            {!newVariable && (
              <button
                type="submit"
                className="btn btn-primary"
                aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.updateButton}
              >
                Update
              </button>
            )}
            {newVariable && (
              <button
                type="submit"
                className="btn btn-primary"
                aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.addButton}
              >
                Add
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  editor: state.templating.editor,
  variable: getVariable(ownProps.identifier.id, state, false), // we could be renaming a variable and we don't want this to throw
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  variableEditorMount,
  variableEditorUnMount,
  changeVariableName,
  changeVariableProp,
  onEditorUpdate,
  onEditorAdd,
  changeVariableType,
};

export const VariableEditorEditor = connectWithStore(
  VariableEditorEditorUnConnected,
  mapStateToProps,
  mapDispatchToProps
);
