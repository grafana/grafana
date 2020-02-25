import React, { ChangeEvent, FormEvent, PureComponent } from 'react';
import isEqual from 'lodash/isEqual';
import { AppEvents } from '@grafana/data';
import { FormLabel } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { dispatch } from '../../../store/store';
import {
  changeVariableHide,
  changeVariableLabel,
  changeVariableName,
  changeVariableProp,
  changeVariableType,
  onEditorAdd,
  onEditorUpdate,
  toVariableIdentifier,
  toVariablePayload,
  variableEditorInit,
  variableEditorUnMounted,
} from '../state/actions';
import { variableAdapters } from '../adapters';
import { emptyUuid, VariableState } from '../state/types';
import { VariableHide, VariableType } from '../variable';
import { appEvents } from '../../../core/core';
import { VariableValuesPreview } from './VariableValuesPreview';

export class VariableEditorEditor extends PureComponent<VariableState> {
  componentDidMount(): void {
    dispatch(variableEditorInit(toVariableIdentifier(this.props.variable)));
  }

  componentDidUpdate(prevProps: Readonly<VariableState>, prevState: Readonly<{}>, snapshot?: any): void {
    if (!isEqual(prevProps.editor.errors, this.props.editor.errors)) {
      Object.values(this.props.editor.errors).forEach(error => {
        appEvents.emit(AppEvents.alertWarning, ['Validation', error]);
      });
    }
  }

  componentWillUnmount(): void {
    dispatch(variableEditorUnMounted(toVariablePayload(this.props.variable)));
  }

  onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    dispatch(changeVariableName(toVariableIdentifier(this.props.variable), event.target.value));
  };

  onTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    dispatch(changeVariableType(toVariableIdentifier(this.props.variable), event.target.value as VariableType));
  };

  onLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    dispatch(changeVariableLabel(toVariablePayload(this.props.variable, event.target.value)));
  };

  onHideChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    dispatch(
      changeVariableHide(toVariablePayload(this.props.variable, parseInt(event.target.value, 10) as VariableHide))
    );
  };

  onPropChanged = (propName: string, propValue: any) => {
    dispatch(changeVariableProp(toVariablePayload(this.props.variable, { propName, propValue })));
  };

  onHandleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!this.props.editor.isValid) {
      return;
    }

    if (this.props.variable.uuid !== emptyUuid) {
      await dispatch(onEditorUpdate(toVariableIdentifier(this.props.variable)));
    }

    if (this.props.variable.uuid === emptyUuid) {
      await dispatch(onEditorAdd(toVariableIdentifier(this.props.variable)));
    }
  };

  render() {
    const EditorToRender = variableAdapters.get(this.props.variable.type).editor;
    if (!EditorToRender) {
      return null;
    }
    const newVariable = this.props.variable.uuid && this.props.variable.uuid === emptyUuid;

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
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.generalNameInput}
                />
              </div>
              <div className="gf-form max-width-19">
                <FormLabel width={6} tooltip={variableAdapters.get(this.props.variable.type).description}>
                  Type
                </FormLabel>
                <div className="gf-form-select-wrapper max-width-17">
                  <select
                    className="gf-form-input"
                    value={this.props.editor.type}
                    onChange={this.onTypeChange}
                    aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.generalTypeSelect}
                  >
                    {variableAdapters.registeredTypes().map(item => (
                      <option key={item.type} label={item.label} value={item.type}>
                        {item.label}
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
                  aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.generalLabelInput}
                />
              </div>
              <div className="gf-form max-width-19">
                <span className="gf-form-label width-6">Hide</span>
                <div className="gf-form-select-wrapper max-width-15">
                  <select
                    className="gf-form-input"
                    value={this.props.variable.hide}
                    onChange={this.onHideChange}
                    aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.generalHideSelect}
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

          {EditorToRender && (
            <EditorToRender
              editor={this.props.editor}
              variable={this.props.variable}
              dataSources={this.props.editor.dataSources}
              onPropChange={this.onPropChanged}
            />
          )}

          <VariableValuesPreview variable={this.props.variable} />

          <div className="gf-form-button-row p-y-0">
            {!newVariable && (
              <button
                type="submit"
                className="btn btn-primary"
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.updateButton}
              >
                Update
              </button>
            )}
            {newVariable && (
              <button
                type="submit"
                className="btn btn-primary"
                aria-label={e2e.pages.Dashboard.Settings.Variables.Edit.General.selectors.addButton}
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
