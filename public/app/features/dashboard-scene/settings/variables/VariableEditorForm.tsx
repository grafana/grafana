import { css } from '@emotion/css';
import { FormEvent, useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { VariableHide, defaultVariableModel } from '@grafana/schema';
import { Button, LoadingPlaceholder, ConfirmModal, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { VariableHideSelect } from 'app/features/dashboard-scene/settings/variables/components/VariableHideSelect';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';
import { VariableValuesPreview } from 'app/features/dashboard-scene/settings/variables/components/VariableValuesPreview';
import { VariableNameConstraints } from 'app/features/variables/editor/types';

import { VariableTypeSelect } from './components/VariableTypeSelect';
import {
  EditableVariableType,
  getVariableEditor,
  hasVariableOptions,
  isEditableVariableType,
  validateVariableName,
} from './utils';

interface VariableEditorFormProps {
  variable: SceneVariable;
  onTypeChange: (type: EditableVariableType) => void;
  onGoBack: () => void;
  onDelete: (variableName: string) => void;
}
export function VariableEditorForm({ variable, onTypeChange, onGoBack, onDelete }: VariableEditorFormProps) {
  const styles = useStyles2(getStyles);
  const [nameError, setNameError] = useState<string>();
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

  const onNameChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      const result = validateVariableName(variable, e.currentTarget.value);
      if (result.errorMessage !== nameError) {
        setNameError(result.errorMessage);
      }
    },
    [variable, nameError]
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
    <form
      aria-label={t('dashboard-scene.variable-editor-form.aria-label-variable-editor-form', 'Variable editor form')}
    >
      <VariableTypeSelect onChange={onVariableTypeChange} type={type} />

      <VariableLegend>
        <Trans i18nKey="dashboard-scene.variable-editor-form.general">General</Trans>
      </VariableLegend>
      <VariableTextField
        name="Name"
        description={t(
          'dashboard-scene.variable-editor-form.description-template-variable-characters',
          'The name of the template variable. (Max. 50 characters)'
        )}
        placeholder={t('dashboard-scene.variable-editor-form.placeholder-variable-name', 'Variable name')}
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
        description={t(
          'dashboard-scene.variable-editor-form.description-optional-display-name',
          'Optional display name'
        )}
        placeholder={t('dashboard-scene.variable-editor-form.placeholder-label-name', 'Label name')}
        defaultValue={label ?? ''}
        onBlur={onLabelBlur}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
      />
      <VariableTextAreaField
        name="Description"
        defaultValue={description ?? ''}
        placeholder={t('dashboard-scene.variable-editor-form.placeholder-descriptive-text', 'Descriptive text')}
        onBlur={onDescriptionBlur}
        width={52}
      />

      <VariableHideSelect onChange={onHideChange} hide={hide || defaultVariableModel.hide!} type={type} />

      {EditorToRender && <EditorToRender variable={variable} onRunQuery={onRunQuery} />}

      {isHasVariableOptions && <VariableValuesPreview options={variable.getOptionsForSelect(false)} />}

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
                <Trans i18nKey="dashboard-scene.variable-editor-form.delete">Delete</Trans>
              </Button>
            )}
          </ModalsController>
          <Button
            variant="secondary"
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
            onClick={onGoBack}
          >
            <Trans i18nKey="dashboard-scene.variable-editor-form.back-to-list">Back to list</Trans>
          </Button>

          {isHasVariableOptions && (
            <Button
              disabled={runQueryState.loading}
              variant="secondary"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              onClick={onRunQuery}
            >
              {runQueryState.loading ? (
                <LoadingPlaceholder
                  className={styles.loadingPlaceHolder}
                  text={t('dashboard-scene.variable-editor-form.text-running-query', 'Running query...')}
                />
              ) : (
                `Run query`
              )}
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
  loadingPlaceHolder: css({
    marginBottom: 0,
  }),
});
