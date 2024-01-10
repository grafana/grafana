import React, { FormEvent } from 'react';

import { SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneVariable } from '@grafana/scenes';
import { VariableHide, defaultVariableModel } from '@grafana/schema';
import { HorizontalGroup, Button } from '@grafana/ui';
import { ConfirmDeleteModal } from 'app/features/variables/editor/ConfirmDeleteModal';
// import { VariableHideSelect } from 'app/features/variables/editor/VariableHideSelect';
import { VariableHideSelect } from 'app/features/variables/editor/VariableHideSelect';
import { VariableLegend } from 'app/features/variables/editor/VariableLegend';
import { VariableTextAreaField } from 'app/features/variables/editor/VariableTextAreaField';
import { VariableTextField } from 'app/features/variables/editor/VariableTextField';
import { VariableValuesPreview } from 'app/features/variables/editor/VariableValuesPreview';
import { VariableNameConstraints } from 'app/features/variables/editor/types';

import { VariableTypeSelect } from './components/VariableTypeSelect';
import { EditableVariableType, getVariableEditor, hasVariableOptions, isEditableVariableType } from './utils';

interface VariableEditorFormProps {
  variable: SceneVariable;
  onTypeChange: (type: EditableVariableType) => void;
  onGoBack: () => void;
  onDiscardChanges: () => void;
}

export function VariableEditorForm({ variable, onTypeChange, onGoBack, onDiscardChanges }: VariableEditorFormProps) {
  const { name: initialName, type, label: initialLabel, description: initialDescription, hide } = variable.useState();
  const EditorToRender = isEditableVariableType(type) ? getVariableEditor(type) : undefined;
  const [name, setName] = React.useState(initialName ?? '');
  const [label, setLabel] = React.useState(initialLabel ?? '');
  const [description, setDescription] = React.useState(initialDescription ?? '');

  const onVariableTypeChange = (option: SelectableValue<VariableType>) => {
    const variableType = option.value && isEditableVariableType(option.value) ? option.value : undefined;

    if (variableType) {
      onTypeChange(variableType);
    }
  };

  function onNameChange(event: FormEvent<HTMLInputElement>) {
    variable.setState({ name });
  }

  function onLabelChange(event: FormEvent<HTMLInputElement>) {
    variable.setState({ label });
  }

  function onDescriptionChange(event: FormEvent<HTMLTextAreaElement>) {
    variable.setState({ description });
  }

  function onHideChange(hide: VariableHide) {
    variable.setState({ hide });
  }

  return (
    <>
      <form aria-label="Variable editor Form">
        <VariableTypeSelect onChange={onVariableTypeChange} type={type} />

        <VariableLegend>General</VariableLegend>
        <VariableTextField
          value={name}
          onBlur={onNameChange}
          onChange={(e: React.FormEvent<HTMLInputElement>) => setName(e.currentTarget.value)}
          name="Name"
          placeholder="Variable name"
          description="The name of the template variable. (Max. 50 characters)"
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
          maxLength={VariableNameConstraints.MaxSize}
          required
        />
        <VariableTextField
          name="Label"
          description="Optional display name"
          value={label}
          onChange={(e: React.FormEvent<HTMLInputElement>) => setLabel(e.currentTarget.value)}
          placeholder="Label name"
          onBlur={onLabelChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
        />
        <VariableTextAreaField
          name="Description"
          value={description}
          onChange={(e: React.FormEvent<HTMLTextAreaElement>) => setDescription(e.currentTarget.value)}
          placeholder="Descriptive text"
          onBlur={onDescriptionChange}
          width={52}
        />

        <VariableHideSelect onChange={onHideChange} hide={hide || defaultVariableModel.hide!} type={type} />

        {EditorToRender && <EditorToRender variable={variable} />}

        {hasVariableOptions(variable) && <VariableValuesPreview options={variable.options} />}

        <div style={{ marginTop: '16px' }}>
          <HorizontalGroup spacing="md" height="inherit">
            {/* <Button variant="destructive" fill="outline" onClick={onModalOpen}>
              Delete
            </Button> */}
            {/* <Button
              type="submit"
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              disabled={loading}
              variant="secondary"
            >
              Run query
              {loading && <Icon className="spin-clockwise" name="sync" size="sm" style={{ marginLeft: '2px' }} />}
            </Button> */}
            <Button
              variant="destructive"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              onClick={onDiscardChanges}
            >
              Discard changes
            </Button>
            <Button
              variant="secondary"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              onClick={onGoBack}
            >
              Back to list
            </Button>
          </HorizontalGroup>
        </div>
      </form>
      <ConfirmDeleteModal
        isOpen={false}
        varName={variable.state.name}
        onConfirm={() => console.log('needs implementation')}
        onDismiss={() => console.log('needs implementation')}
      />
    </>
  );
}
