import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button } from '@grafana/ui';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardSceneState } from '../scene/types/dashboard';
import { type Diffs } from '../settings/version-history/utils';

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
  hasPredefinedVariablesChanges?: boolean;
  hasMigratedToV2?: boolean;
}

/**
 * A dashboard that has never been saved: no uid and no k8s name yet. Not the save model's version: a
 * previewed repo file reports version 0 while it already has a uid, and saving it updates the file
 */
export function isNewDashboard({ uid, meta }: Pick<DashboardSceneState, 'uid' | 'meta'>): boolean {
  return !uid && !meta.k8s?.name;
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

const FOLDER_BOUND_ANNOTATIONS: readonly string[] = [AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath];

/**
 * Meta after a new save (new dashboard or Save As) picks a folder. The manager and source-path
 * annotations describe where a previewed or copied file came from; the picked folder now decides the
 * repository, so they go. Identity fields (name, resourceVersion) and every other annotation stay.
 */
export function nextMetaAfterFolderPick(
  meta: DashboardMeta,
  folderUid: string | undefined,
  folderTitle: string | undefined
): DashboardMeta {
  const annotations = meta.k8s?.annotations;
  const k8s = annotations
    ? {
        ...meta.k8s,
        annotations: Object.fromEntries(
          Object.entries(annotations).filter(([key]) => !FOLDER_BOUND_ANNOTATIONS.includes(key))
        ),
      }
    : meta.k8s;
  return { ...meta, folderUid, folderTitle, k8s };
}

export function NameAlreadyExistsError() {
  return (
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
