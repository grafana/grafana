import { css } from '@emotion/css';
import { type FormEvent, useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { type SceneVariable } from '@grafana/scenes';
import { type VariableHide, defaultVariableModel } from '@grafana/schema';
import { Alert, Button, ConfirmModal, LoadingPlaceholder, ModalsController, Stack, useStyles2 } from '@grafana/ui';
import { VariableDisplaySelect } from 'app/features/dashboard-scene/settings/variables/components/VariableDisplaySelect';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';
import {
  useGetAllVariableOptions,
  VariableValuesPreview,
} from 'app/features/dashboard-scene/settings/variables/components/VariableValuesPreview';
import { VariableNameConstraints } from 'app/features/variables/editor/types';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getTopPlacementLabel } from '../../utils/getTopPlacementLabel';

import { VariableTypeSelect } from './components/VariableTypeSelect';
import {
  type EditableVariableType,
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
  /** True when rendering outside a dashboard (e.g. the variables management page). */
  standalone?: boolean;
  /** Notifies the host when the name field enters or leaves an invalid state, so it can gate its own save action. */
  onNameErrorChange?: (hasError: boolean) => void;
  /**
   * Host-owned name error (e.g. API collision check in the standalone editor).
   * Shown when local format validation has not already failed.
   */
  externalNameError?: string;
}
export function VariableEditorForm({
  variable,
  onTypeChange,
  onGoBack,
  onDelete,
  standalone,
  onNameErrorChange,
  externalNameError,
}: VariableEditorFormProps) {
  const styles = useStyles2(getStyles);
  const [nameError, setNameError] = useState<string>();
  const [nameWarning, setNameWarning] = useState<string>();
  const { name, type, label, description, hide: display } = variable.useState();
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
      const nextName = e.currentTarget.value;
      const result = validateVariableName(variable, nextName);
      if (result.errorMessage !== nameError) {
        setNameError(result.errorMessage);
        onNameErrorChange?.(Boolean(result.errorMessage));
      }
      if (result.warningMessage !== nameWarning) {
        setNameWarning(result.warningMessage);
      }
      // Commit on change (not only blur) so Save / Preview see the typed name
      // even when the field still has focus — same pattern as the edit pane.
      if (!result.errorMessage) {
        variable.setState({ name: nextName });
      }
    },
    [variable, nameError, nameWarning, onNameErrorChange]
  );

  const onLabelBlur = (e: FormEvent<HTMLInputElement>) => variable.setState({ label: e.currentTarget.value });
  const onDescriptionBlur = (e: FormEvent<HTMLTextAreaElement>) =>
    variable.setState({ description: e.currentTarget.value });
  const onDisplayChange = (display: VariableHide) => variable.setState({ hide: display });
  const sectionOwner = dashboardSceneGraph.findSectionOwner(variable);
  const topPlacementLabel = sectionOwner ? getTopPlacementLabel(sectionOwner) : undefined;

  const isHasVariableOptions = hasVariableOptions(variable);

  const onDeleteVariable = (hideModal: () => void) => () => {
    reportInteraction('Delete variable');
    onDelete(name);
    hideModal();
  };

  const { options, staticOptions } = useGetAllVariableOptions(variable);

  return (
    <form
      aria-label={t('dashboard-scene.variable-editor-form.aria-label-variable-editor-form', 'Variable editor form')}
    >
      <VariableTypeSelect onChange={onVariableTypeChange} type={type} standalone={standalone} />

      <VariableLegend>
        <Trans i18nKey="dashboard-scene.variable-editor-form.general">General</Trans>
      </VariableLegend>
      <VariableTextField
        name={t('dashboard-scene.variable-editor-form.name-name', 'Name')}
        description={t(
          'dashboard-scene.variable-editor-form.description-template-variable-characters',
          'The name of the template variable. (Max. 50 characters)'
        )}
        placeholder={t('dashboard-scene.variable-editor-form.placeholder-variable-name', 'Variable name')}
        defaultValue={name ?? ''}
        onChange={onNameChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
        maxLength={VariableNameConstraints.MaxSize}
        required
        invalid={!!(nameError || externalNameError)}
        error={nameError || externalNameError}
      />
      {nameWarning && <Alert title={nameWarning} severity="warning" bottomSpacing={2} />}
      <VariableTextField
        name={t('dashboard-scene.variable-editor-form.name-label', 'Label')}
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
        name={t('dashboard-scene.variable-editor-form.name-description', 'Description')}
        defaultValue={description ?? ''}
        placeholder={t('dashboard-scene.variable-editor-form.placeholder-descriptive-text', 'Descriptive text')}
        onBlur={onDescriptionBlur}
        width={52}
      />

      <VariableDisplaySelect
        onChange={onDisplayChange}
        display={display || defaultVariableModel.hide!}
        type={type}
        topPlacementLabel={topPlacementLabel}
      />

      {EditorToRender && <EditorToRender variable={variable} onRunQuery={onRunQuery} />}

      {isHasVariableOptions && <VariableValuesPreview options={options} staticOptions={staticOptions} />}

      <div className={styles.buttonContainer}>
        <Stack gap={2}>
          {/* Standalone hosts render their own delete and navigation actions in a single row. */}
          {!standalone && (
            <ModalsController>
              {({ showModal, hideModal }) => (
                <Button
                  variant="destructive"
                  fill="outline"
                  onClick={() => {
                    showModal(ConfirmModal, {
                      title: t('dashboard-scene.variable-editor-form.title.delete-variable', 'Delete variable'),
                      body: `Are you sure you want to delete: ${name}?`,
                      confirmText: t(
                        'dashboard-scene.variable-editor-form.confirmText.delete-variable',
                        'Delete variable'
                      ),
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
          )}
          {!standalone && (
            <Button
              variant="secondary"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              onClick={onGoBack}
            >
              <Trans i18nKey="dashboard-scene.variable-editor-form.back-to-list">Back to list</Trans>
            </Button>
          )}

          {isHasVariableOptions && (
            <Button
              disabled={runQueryState.loading}
              variant="primary"
              fill="outline"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              onClick={onRunQuery}
            >
              {runQueryState.loading ? (
                <LoadingPlaceholder
                  className={styles.loadingPlaceHolder}
                  text={t('dashboard-scene.variable-editor-form.text-running-query', 'Running query...')}
                />
              ) : (
                <Trans i18nKey="dashboard.edit-pane.variable.query-options.preview">Preview</Trans>
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
