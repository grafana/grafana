import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Checkbox, TextArea, Stack, Alert, Box, Field } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import {
  DashboardChangeInfo,
  NameAlreadyExistsError,
  SaveButton,
  isNameExistsError,
  isPluginDashboardError,
  isVersionMismatchError,
} from './shared';
import { useSaveDashboard } from './useSaveDashboard';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const { hasChanges, hasMigratedToV2, changedSaveModel } = changeInfo;

  const { state, onSaveDashboard } = useSaveDashboard(false);
  const [options, setOptions] = useState<SaveDashboardOptions>({
    folderUid: dashboard.state.meta.folderUid,
    // we need to set the uid here in order to save the dashboard
    // in schema v2 we don't have the uid in the spec
    k8s: {
      ...dashboard.state.meta.k8s,
    },
  });

  const onSave = async (overwrite: boolean) => {
    const result = await onSaveDashboard(dashboard, { ...options, rawDashboardJSON: changedSaveModel, overwrite });
    if (result.status === 'success') {
      dashboard.closeModal();
      drawer.state.onSaveSuccess?.();
    }
  };

  const cancelButton = (
    <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
      <Trans i18nKey="dashboard-scene.save-dashboard-form.cancel-button.cancel">Cancel</Trans>
    </Button>
  );

  const saveButton = (overwrite: boolean) => (
    <SaveButton isValid={hasChanges} isLoading={state.loading} onSave={onSave} overwrite={overwrite} />
  );

  const isMessageTooLongError = (message?: string) => {
    return message && message.length > 500;
  };

  function renderFooter(error?: Error) {
    if (isMessageTooLongError(options.message)) {
      const messageLength = options.message?.length ?? 0;

      return (
        <Alert title={t('save-dashboards.message-length.title', 'Message too long')} severity="error">
          <p>
            <Trans i18nKey="save-dashboards.message-length.info">
              The message is {{ messageLength }} characters, which exceeds the maximum length of 500 characters. Please
              shorten it before saving.
            </Trans>
          </p>
        </Alert>
      );
    }

    if (isVersionMismatchError(error)) {
      return (
        <Alert
          title={t(
            'dashboard-scene.save-dashboard-form.render-footer.title-someone-else-has-updated-this-dashboard',
            'Someone else has updated this dashboard'
          )}
          severity="error"
        >
          <p>
            <Trans i18nKey="dashboard-scene.save-dashboard-form.render-footer.would-still-dashboard">
              Would you still like to save this dashboard?
            </Trans>
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton(true)}
            </Stack>
          </Box>
        </Alert>
      );
    }

    if (isNameExistsError(error)) {
      return <NameAlreadyExistsError cancelButton={cancelButton} saveButton={saveButton} />;
    }

    if (isPluginDashboardError(error)) {
      return (
        <Alert
          title={t('dashboard-scene.save-dashboard-form.render-footer.title-plugin-dashboard', 'Plugin dashboard')}
          severity="error"
        >
          <p>
            Your changes will be lost when you update the plugin. Use <strong>Save As</strong> to create custom version.
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton(true)}
            </Stack>
          </Box>
        </Alert>
      );
    }

    return (
      <>
        {error && (
          <Alert
            title={t(
              'dashboard-scene.save-dashboard-form.render-footer.title-failed-to-save-dashboard',
              'Failed to save dashboard'
            )}
            severity="error"
          >
            <p>{error.message}</p>
          </Alert>
        )}
        <Stack alignItems="center">
          {cancelButton}
          {saveButton(false)}
          {!hasChanges && (
            <div>
              <Trans i18nKey="dashboard-scene.save-dashboard-form.render-footer.no-changes-to-save">
                No changes to save
              </Trans>
            </div>
          )}
        </Stack>
      </>
    );
  }

  return (
    <Stack gap={2} direction="column">
      <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />
      {hasMigratedToV2 && (
        <Alert
          title={t(
            'dashboard-scene.save-dashboard-form.title-dashboard-drastically-changed',
            'Dashboard drastically changed'
          )}
          severity="warning"
        >
          <p>
            Because you're using new dashboards features only supported on new Grafana dashboard schema format, the
            dashboard will be saved in the new format. Please make sure you want to perform this action or you prefer to
            save the dashboard as a new copy.
          </p>
        </Alert>
      )}
      <Field label={t('dashboard-scene.save-dashboard-form.label-message', 'Message')}>
        <TextArea
          aria-label={t('dashboard-scene.save-dashboard-form.aria-label-message', 'message')}
          value={options.message ?? ''}
          onChange={(e) => {
            setOptions({
              ...options,
              message: e.currentTarget.value,
            });
          }}
          placeholder={t(
            'dashboard-scene.save-dashboard-form.placeholder-describe-changes-optional',
            'Add a note to describe your changes (optional).'
          )}
          autoFocus
          rows={5}
        />
      </Field>
      {renderFooter(state.error)}
    </Stack>
  );
}

export interface SaveDashboardFormCommonOptionsProps {
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardFormCommonOptions({ drawer, changeInfo }: SaveDashboardFormCommonOptionsProps) {
  const { saveVariables = false, saveTimeRange = false, saveRefresh = false } = drawer.useState();
  const { hasTimeChanges, hasVariableValueChanges, hasRefreshChange } = changeInfo;

  return (
    <Stack direction={'column'} alignItems={'flex-start'}>
      {hasTimeChanges && (
        <Checkbox
          id="save-timerange"
          checked={saveTimeRange}
          onChange={drawer.onToggleSaveTimeRange}
          label={t(
            'dashboard-scene.save-dashboard-form-common-options.save-timerange-label-update-default-time-range',
            'Update default time range'
          )}
          description={'Will make current time range the new default'}
          data-testid={selectors.pages.SaveDashboardModal.saveTimerange}
        />
      )}
      {hasRefreshChange && (
        <Checkbox
          id="save-refresh"
          label={t(
            'dashboard-scene.save-dashboard-form-common-options.save-refresh-label-update-default-refresh-value',
            'Update default refresh value'
          )}
          description={t(
            'dashboard-scene.save-dashboard-form-common-options.save-refresh-description-current-refresh-default',
            'Will make the current refresh the new default'
          )}
          checked={saveRefresh}
          onChange={drawer.onToggleSaveRefresh}
          data-testid={selectors.pages.SaveDashboardModal.saveRefresh}
        />
      )}
      {hasVariableValueChanges && (
        <Checkbox
          id="save-variables"
          label={t(
            'dashboard-scene.save-dashboard-form-common-options.save-variables-label-update-default-variable-values',
            'Update default variable values'
          )}
          description={t(
            'dashboard-scene.save-dashboard-form-common-options.save-variables-description-current-values-default',
            'Will make the current values the new default'
          )}
          checked={saveVariables}
          onChange={drawer.onToggleSaveVariables}
          data-testid={selectors.pages.SaveDashboardModal.saveVariables}
        />
      )}
    </Stack>
  );
}
