import React, { FormEvent } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneVariable } from '@grafana/scenes';
import { VariableHide, defaultVariableModel } from '@grafana/schema';
import { HorizontalGroup, Button, LoadingPlaceholder } from '@grafana/ui';
import { VariableHideSelect } from 'app/features/dashboard-scene/settings/variables/components/VariableHideSelect';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';
import { VariableValuesPreview } from 'app/features/dashboard-scene/settings/variables/components/VariableValuesPreview';
import { ConfirmDeleteModal } from 'app/features/variables/editor/ConfirmDeleteModal';
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
  const { name, type, label, description, hide } = variable.useState();
  const EditorToRender = isEditableVariableType(type) ? getVariableEditor(type) : undefined;
  const [runQueryState, onRunQuery] = useAsyncFn(async () => {
    await lastValueFrom(variable.validateAndUpdate!());
  }, [variable]);

  const onVariableTypeChange = (option: SelectableValue<EditableVariableType>) => {
    if (option.value) {
      onTypeChange(option.value);
    }
  };

  const onNameBlur = (e: FormEvent<HTMLInputElement>) => variable.setState({ name: e.currentTarget.value });
  const onLabelBlur = (e: FormEvent<HTMLInputElement>) => variable.setState({ label: e.currentTarget.value });
  const onDescriptionBlur = (e: FormEvent<HTMLTextAreaElement>) =>
    variable.setState({ description: e.currentTarget.value });
  const onHideChange = (hide: VariableHide) => variable.setState({ hide });
  const isHasVariableOptions = hasVariableOptions(variable);

  return (
    <>
      <form aria-label="Variable editor Form">
        <VariableTypeSelect onChange={onVariableTypeChange} type={type} />

        <VariableLegend>General</VariableLegend>
        <VariableTextField
          name="Name"
          description="The name of the template variable. (Max. 50 characters)"
          placeholder="Variable name"
          defaultValue={name ?? ''}
          onBlur={onNameBlur}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
          maxLength={VariableNameConstraints.MaxSize}
          required
        />
        <VariableTextField
          name="Label"
          description="Optional display name"
          placeholder="Label name"
          defaultValue={label ?? ''}
          onBlur={onLabelBlur}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
        />
        <VariableTextAreaField
          name="Description"
          defaultValue={description ?? ''}
          placeholder="Descriptive text"
          onBlur={onDescriptionBlur}
          width={52}
        />

        <VariableHideSelect onChange={onHideChange} hide={hide || defaultVariableModel.hide!} type={type} />

        {EditorToRender && <EditorToRender variable={variable} onRunQuery={onRunQuery} />}

        {isHasVariableOptions && <VariableValuesPreview options={variable.getOptionsForSelect()} />}

        <div style={{ marginTop: '16px' }}>
          <HorizontalGroup spacing="md" height="inherit">
            {/* <Button variant="destructive" fill="outline" onClick={onModalOpen}>
              Delete
            </Button> */}
            <Button
              variant="secondary"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              onClick={onGoBack}
            >
              Back to list
            </Button>

            {isHasVariableOptions && (
              <Button
                disabled={runQueryState.loading}
                variant="secondary"
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
                onClick={onRunQuery}
              >
                {runQueryState.loading ? <LoadingPlaceholder text="Running query..." /> : `Run query`}
              </Button>
            )}
            <Button
              variant="destructive"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              onClick={onDiscardChanges}
            >
              Discard changes
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
