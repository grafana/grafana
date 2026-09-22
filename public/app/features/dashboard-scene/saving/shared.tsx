import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardSceneState } from '../scene/types/dashboard';
import { type Diffs } from '../settings/version-history/utils';

import { type SaveDashboardErrorInfo } from './saveErrors';

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

/**
 * Renders the save failures that leave the form usable, so the user can correct the dashboard and
 * retry. Conflicts and name collisions are rendered by their callers instead, because they replace
 * the footer with their own recovery actions.
 */
export function SaveDashboardErrorAlert({ info }: { info: SaveDashboardErrorInfo }) {
  const styles = useStyles2(getSaveDashboardErrorStyles);

  // Alert already pads its body, so the text is rendered bare: a <p> would add its global
  // bottom margin on top of that padding and leave the alert looking bottom-heavy.
  const body =
    info.causes.length > 0 ? (
      <ul className={styles.causes}>
        {info.causes.map((cause) => (
          <li key={cause}>{cause}</li>
        ))}
      </ul>
    ) : (
      info.message
    );

  if (info.kind === 'forbidden') {
    return (
      <Alert
        title={t('save-dashboards.forbidden.title', 'You do not have permission to save this dashboard')}
        severity="error"
      >
        {body}
      </Alert>
    );
  }

  if (info.kind === 'invalid') {
    return (
      <Alert title={t('save-dashboards.invalid.title', 'This dashboard is not valid')} severity="error">
        {body}
      </Alert>
    );
  }

  return (
    <Alert
      title={t(
        'dashboard-scene.save-dashboard-form.render-footer.title-failed-to-save-dashboard',
        'Failed to save dashboard'
      )}
      severity="error"
    >
      {body}
    </Alert>
  );
}

const getSaveDashboardErrorStyles = (theme: GrafanaTheme2) => ({
  causes: css({
    margin: 0,
    paddingLeft: theme.spacing(2),
  }),
});

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
  /** Blocks the save for a reason other than validity or an in-flight save; the caller explains it in its own UI */
  disabled?: boolean;
}

export function SaveButton({ overwrite, isLoading, isValid, onSave, disabled = false }: SaveButtonProps) {
  return (
    <Button
      disabled={disabled || !isValid || isLoading}
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
