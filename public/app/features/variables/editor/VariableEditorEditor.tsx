import { isEqual } from 'lodash';
import React, { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { AppEvents, LoadingState, SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, InlineFieldRow, VerticalGroup } from '@grafana/ui';

import { appEvents } from '../../../core/core';
import { StoreState, ThunkDispatch } from '../../../types';
import { variableAdapters } from '../adapters';
import { hasOptions } from '../guard';
import { updateOptions } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../state/selectors';
import { changeVariableProp, changeVariableType, removeVariable } from '../state/sharedReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { VariableHide } from '../types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { VariableHideSelect } from './VariableHideSelect';
import { VariableSectionHeader } from './VariableSectionHeader';
import { VariableTextField } from './VariableTextField';
import { VariableTypeSelect } from './VariableTypeSelect';
import { VariableValuesPreview } from './VariableValuesPreview';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { OnPropChangeArguments } from './types';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => ({
  editor: getVariablesState(ownProps.identifier.rootStateKey, state).editor,
  variable: getVariable(ownProps.identifier, state),
});

const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {
    ...bindActionCreators({ variableEditorMount, variableEditorUnMount, changeVariableName, updateOptions }, dispatch),
    changeVariableProp: (identifier: KeyedVariableIdentifier, propName: string, propValue: any) =>
      dispatch(
        toKeyedAction(
          identifier.rootStateKey,
          changeVariableProp(toVariablePayload(identifier, { propName, propValue }))
        )
      ),
    changeVariableType: (identifier: KeyedVariableIdentifier, newType: VariableType) =>
      dispatch(toKeyedAction(identifier.rootStateKey, changeVariableType(toVariablePayload(identifier, { newType })))),
    removeVariable: (identifier: KeyedVariableIdentifier) => {
      dispatch(
        toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true })))
      );
    },
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps {
  identifier: KeyedVariableIdentifier;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export class VariableEditorEditorUnConnected extends PureComponent<Props> {
  componentDidMount(): void {
    this.props.variableEditorMount(this.props.identifier);
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any): void {
    if (!isEqual(prevProps.editor.errors, this.props.editor.errors)) {
      Object.values(this.props.editor.errors).forEach((error) => {
        appEvents.emit(AppEvents.alertWarning, ['Validation', error]);
      });
    }
  }

  componentWillUnmount(): void {
    this.props.variableEditorUnMount(this.props.identifier);
  }

  onNameChange = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableName(this.props.identifier, event.currentTarget.value);
  };

  onTypeChange = (option: SelectableValue<VariableType>) => {
    if (!option.value) {
      return;
    }
    this.props.changeVariableType(this.props.identifier, option.value);
  };

  onLabelChange = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableProp(this.props.identifier, 'label', event.currentTarget.value);
  };

  onDescriptionChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.changeVariableProp(this.props.identifier, 'description', event.currentTarget.value);
  };

  onHideChange = (option: SelectableValue<VariableHide>) => {
    this.props.changeVariableProp(this.props.identifier, 'hide', option.value);
  };

  onPropChanged = ({ propName, propValue, updateOptions = false }: OnPropChangeArguments) => {
    this.props.changeVariableProp(this.props.identifier, propName, propValue);

    if (updateOptions) {
      this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
    }
  };

  onHandleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!this.props.editor.isValid) {
      return;
    }

    this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
  };

  onDelete = () => {
    this.props.removeVariable(this.props.identifier);
    locationService.partial({ editIndex: null });
  };

  onApply = () => {
    locationService.partial({ editIndex: null });
  };

  render() {
    const { variable } = this.props;
    const EditorToRender = variableAdapters.get(this.props.variable.type).editor;
    if (!EditorToRender) {
      return null;
    }
    const loading = variable.state === LoadingState.Loading;

    return (
      <div>
        <form aria-label="Variable editor Form" onSubmit={this.onHandleSubmit}>
          <VerticalGroup spacing="lg">
            <VerticalGroup spacing="none">
              <VariableSectionHeader name="General" />
              <InlineFieldRow>
                <VariableTextField
                  value={this.props.editor.name}
                  onChange={this.onNameChange}
                  name="Name"
                  placeholder="name"
                  required
                  testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
                />
                <VariableTypeSelect onChange={this.onTypeChange} type={this.props.variable.type} />
              </InlineFieldRow>

              {this.props.editor.errors.name && (
                <div className="gf-form">
                  <span className="gf-form-label gf-form-label--error">{this.props.editor.errors.name}</span>
                </div>
              )}

              <InlineFieldRow>
                <VariableTextField
                  value={this.props.variable.label ?? ''}
                  onChange={this.onLabelChange}
                  name="Label"
                  placeholder="optional display name"
                  testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
                />
                <VariableHideSelect
                  onChange={this.onHideChange}
                  hide={this.props.variable.hide}
                  type={this.props.variable.type}
                />
              </InlineFieldRow>

              <VariableTextField
                name="Description"
                value={variable.description ?? ''}
                placeholder="descriptive text"
                onChange={this.onDescriptionChange}
                grow
              />
            </VerticalGroup>

            {EditorToRender && <EditorToRender variable={this.props.variable} onPropChange={this.onPropChanged} />}

            {hasOptions(this.props.variable) ? <VariableValuesPreview variable={this.props.variable} /> : null}

            <HorizontalGroup spacing="md">
              <Button variant="destructive" onClick={this.onDelete}>
                Delete
              </Button>
              <Button
                type="submit"
                aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
                disabled={loading}
                variant={'secondary'}
              >
                Run query
                {loading ? (
                  <Icon className="spin-clockwise" name="sync" size="sm" style={{ marginLeft: '2px' }} />
                ) : null}
              </Button>
              <Button variant="primary" onClick={this.onApply}>
                Apply
              </Button>
            </HorizontalGroup>
          </VerticalGroup>
        </form>
      </div>
    );
  }
}

export const VariableEditorEditor = connector(VariableEditorEditorUnConnected);
