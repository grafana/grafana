import React, { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { LoadingState, SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon } from '@grafana/ui';

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

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableHideSelect } from './VariableHideSelect';
import { VariableLegend } from './VariableLegend';
import { VariableTextAreaField } from './VariableTextAreaField';
import { VariableTextField } from './VariableTextField';
import { VariableTypeSelect } from './VariableTypeSelect';
import { VariableValuesPreview } from './VariableValuesPreview';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { OnPropChangeArguments, VariableNameConstraints } from './types';

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

interface State {
  showDeleteModal: boolean;
}

export class VariableEditorEditorUnConnected extends PureComponent<Props, State> {
  state: State = {
    showDeleteModal: false,
  };

  componentDidMount(): void {
    this.props.variableEditorMount(this.props.identifier);
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

  onDescriptionChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.props.changeVariableProp(this.props.identifier, 'description', event.currentTarget.value);
  };

  onHideChange = (option: VariableHide) => {
    this.props.changeVariableProp(this.props.identifier, 'hide', option);
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

  onModalOpen = () => {
    this.setState({ showDeleteModal: true });
  };

  onModalClose = () => {
    this.setState({ showDeleteModal: false });
  };

  onDelete = () => {
    this.props.removeVariable(this.props.identifier);
    this.onModalClose();
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
      <>
        <form aria-label="Variable editor Form" onSubmit={this.onHandleSubmit}>
          <VariableTypeSelect onChange={this.onTypeChange} type={this.props.variable.type} />

          <VariableLegend>General</VariableLegend>
          <VariableTextField
            value={this.props.editor.name}
            onChange={this.onNameChange}
            name="Name"
            placeholder="Variable name"
            description="The name of the template variable. (Max. 50 characters)"
            invalid={!!this.props.editor.errors.name}
            error={this.props.editor.errors.name}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
            maxLength={VariableNameConstraints.MaxSize}
            required
          />

          <VariableTextField
            name="Label"
            description="Optional display name"
            value={this.props.variable.label ?? ''}
            placeholder="Label name"
            onChange={this.onLabelChange}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
          />
          <VariableTextAreaField
            name="Description"
            value={variable.description ?? ''}
            placeholder="Descriptive text"
            onChange={this.onDescriptionChange}
            width={52}
          />
          <VariableHideSelect
            onChange={this.onHideChange}
            hide={this.props.variable.hide}
            type={this.props.variable.type}
          />

          {EditorToRender && <EditorToRender variable={this.props.variable} onPropChange={this.onPropChanged} />}

          {hasOptions(this.props.variable) ? <VariableValuesPreview variable={this.props.variable} /> : null}

          <div style={{ marginTop: '16px' }}>
            <HorizontalGroup spacing="md" height="inherit">
              <Button variant="destructive" fill="outline" onClick={this.onModalOpen}>
                Delete
              </Button>
              <Button
                type="submit"
                aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
                disabled={loading}
                variant="secondary"
              >
                Run query
                {loading && <Icon className="spin-clockwise" name="sync" size="sm" style={{ marginLeft: '2px' }} />}
              </Button>
              <Button
                variant="primary"
                onClick={this.onApply}
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              >
                Apply
              </Button>
            </HorizontalGroup>
          </div>
        </form>
        <ConfirmDeleteModal
          isOpen={this.state.showDeleteModal}
          varName={this.props.editor.name}
          onConfirm={this.onDelete}
          onDismiss={this.onModalClose}
        />
      </>
    );
  }
}

export const VariableEditorEditor = connector(VariableEditorEditorUnConnected);
