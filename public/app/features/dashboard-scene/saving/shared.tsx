import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Alert, Box, Button, Stack } from '@grafana/ui';
import { WorkflowOption } from 'app/features/provisioning/types';

import { Diffs } from '../settings/version-history/utils';

export interface DashboardChangeInfo {
  changedSaveModel: Dashboard | DashboardV2Spec;
  initialSaveModel: Dashboard | DashboardV2Spec;
  diffs: Diffs;
  diffCount: number;
  hasChanges: boolean;
  hasTimeChanges: boolean;
  hasVariableValueChanges: boolean;
  hasRefreshChange: boolean;
  isNew?: boolean;
  hasFolderChanges?: boolean;
  hasMigratedToV2?: boolean;
}

export interface BaseProvisionedFormData {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
}

export interface ProvisionedDashboardFormData extends BaseProvisionedFormData {
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
}

export function isVersionMismatchError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'version-mismatch';
}

export function isNameExistsError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'name-exists';
}

export function isPluginDashboardError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'plugin-dashboard';
}

export interface NameAlreadyExistsErrorProps {
  cancelButton: React.ReactNode;
  saveButton: (overwrite: boolean) => React.ReactNode;
}

export function NameAlreadyExistsError({ cancelButton, saveButton }: NameAlreadyExistsErrorProps) {
  const isRestoreDashboardsEnabled = config.featureToggles.restoreDashboards;
  return isRestoreDashboardsEnabled ? (
    <Alert title={t('save-dashboards.name-exists.title', 'Dashboard name already exists')} severity="error">
      <p>
        <Trans i18nKey="save-dashboards.name-exists.message-info">
          A dashboard with the same name in the selected folder already exists, including recently deleted dashboards.
        </Trans>
      </p>
      <p>
        <Trans i18nKey="save-dashboards.name-exists.message-suggestion">
          Please choose a different name or folder.
        </Trans>
      </p>
    </Alert>
  ) : (
    <Alert
      title={t('dashboard-scene.name-already-exists-error.title-name-already-exists', 'Name already exists')}
      severity="error"
    >
      <p>
        <Trans i18nKey="dashboard-scene.name-already-exists-error.body-name-already-exists">
          A dashboard with the same name in selected folder already exists. Would you still like to save this dashboard?
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

export interface SaveButtonProps {
  overwrite: boolean;
  onSave: (overwrite: boolean) => void;
  isLoading: boolean;
  isValid?: boolean;
}

export function SaveButton({ overwrite, isLoading, isValid, onSave }: SaveButtonProps) {
  return (
    <Button
      disabled={!isValid || isLoading}
      icon={isLoading ? 'spinner' : undefined}
      onClick={() => onSave(overwrite)}
      variant={overwrite ? 'destructive' : 'primary'}
      data-testid={selectors.components.Drawer.DashboardSaveDrawer.saveButton}
    >
      {isLoading
        ? t('dashboard-scene.save-button.saving', 'Saving...')
        : overwrite
          ? t('dashboard-scene.save-button.save-and-overwrite', 'Save and overwrite')
          : t('dashboard-scene.save-button.save', 'Save')}
    </Button>
  );
}
