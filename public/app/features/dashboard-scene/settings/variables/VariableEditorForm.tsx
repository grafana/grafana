import { css } from '@emotion/css';
import React, { FormEvent, useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { VariableHide, defaultVariableModel } from '@grafana/schema';
import { Button, LoadingPlaceholder, ConfirmModal, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { VariableHideSelect } from 'app/features/dashboard-scene/settings/variables/components/VariableHideSelect';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';
import { VariableValuesPreview } from 'app/features/dashboard-scene/settings/variables/components/VariableValuesPreview';
import { VariableNameConstraints } from 'app/features/variables/editor/types';

import { VariableTypeSelect } from './components/VariableTypeSelect';
import { EditableVariableType, getVariableEditor, hasVariableOptions, isEditableVariableType } from './utils';

const RESERVED_GLOBAL_VARIABLE_NAME_REGEX = /^(?!__).*$/;
const WORD_CHARACTERS_REGEX = /^\w+$/;

interface VariableEditorFormProps {
  variable: SceneVariable;
  onTypeChange: (type: EditableVariableType) => void;
  onGoBack: () => void;
  onDelete: (variableName: string) => void;
  isVariableNameTaken: (name: string, key: string | undefined) => boolean;
}
export function VariableEditorForm({
  variable,
  onTypeChange,
  onGoBack,
  onDelete,
  isVariableNameTaken,
}: VariableEditorFormProps) {
  const styles = useStyles2(getStyles);
  const [nameError, setNameError] = useState<string | null>(null);
  const { name, type, label, description, hide, key } = variable.useState();
  const EditorToRender = isEditableVariableType(type) ? getVariableEditor(type) : undefined;
  const [runQueryState, onRunQuery] = useAsyncFn(async () => {
    await lastValueFrom(variable.validateAndUpdate!());
  }, [variable]);
  const onVariableTypeChange = (option: SelectableValue<EditableVariableType>) => {
    if (option.value) {
      onTypeChange(option.value);
    }
  };

  const onNameChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      let errorText = null;
      if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(e.currentTarget.value)) {
        errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
      }

      if (!WORD_CHARACTERS_REGEX.test(e.currentTarget.value)) {
        errorText = 'Only word characters are allowed in variable names';
      }

      if (isVariableNameTaken(e.currentTarget.value, key || '')) {
        errorText = 'Variable with the same name already exists';
      }

      if (errorText !== nameError) {
        setNameError(errorText);
      }
    },
    [isVariableNameTaken, key, nameError]
  );

  const onNameBlur = (e: FormEvent<HTMLInputElement>) => {
    if (!nameError) {
      variable.setState({ name: e.currentTarget.value });
    }
  };

  const onLabelBlur = (e: FormEvent<HTMLInputElement>) => variable.setState({ label: e.currentTarget.value });
  const onDescriptionBlur = (e: FormEvent<HTMLTextAreaElement>) =>
    variable.setState({ description: e.currentTarget.value });
  const onHideChange = (hide: VariableHide) => variable.setState({ hide });

  const isHasVariableOptions = hasVariableOptions(variable);

  const onDeleteVariable = (hideModal: () => void) => () => {
    reportInteraction('Delete variable');
    onDelete(name);
    hideModal();
  };

  return (
    <form aria-label="Variable editor Form">
      <VariableTypeSelect onChange={onVariableTypeChange} type={type} />

      <VariableLegend>General</VariableLegend>
      <VariableTextField
        name="Name"
        description="The name of the template variable. (Max. 50 characters)"
        placeholder="Variable name"
        defaultValue={name ?? ''}
        onChange={onNameChange}
        onBlur={onNameBlur}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
        maxLength={VariableNameConstraints.MaxSize}
        required
        invalid={!!nameError}
        error={nameError}
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

      <div className={styles.buttonContainer}>
        <Stack gap={2}>
          <ModalsController>
            {({ showModal, hideModal }) => (
              <Button
                variant="destructive"
                fill="outline"
                onClick={() => {
                  showModal(ConfirmModal, {
                    title: 'Delete variable',
                    body: `Are you sure you want to delete: ${name}?`,
                    confirmText: 'Delete variable',
                    onConfirm: onDeleteVariable(hideModal),
                    onDismiss: hideModal,
                    isOpen: true,
                  });
                }}
              >
                Delete
              </Button>
            )}
          </ModalsController>
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
        </Stack>
      </div>
    </form>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonContainer: css({
    marginTop: theme.spacing(2),
  }),
});
