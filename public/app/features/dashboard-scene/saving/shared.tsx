import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button } from '@grafana/ui';

import { type Diffs } from '../settings/version-history/utils';

import { getSaveDashboardErrorInfo, type SaveDashboardErrorInfo } from './saveErrors';

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

export function isVersionMismatchError(error?: Error) {
  return getSaveDashboardErrorInfo(error)?.kind === 'conflict';
}

export function isNameExistsError(error?: Error) {
  return getSaveDashboardErrorInfo(error)?.kind === 'already-exists';
}

export function isPluginDashboardError(error?: Error) {
  return getSaveDashboardErrorInfo(error)?.kind === 'plugin-dashboard';
}

/**
 * Renders the save failures that leave the form usable, so the user can correct the dashboard and
 * retry. Conflicts and name collisions are rendered by their callers instead, because they replace
 * the footer with their own recovery actions.
 */
export function SaveDashboardErrorAlert({ info }: { info: SaveDashboardErrorInfo }) {
  if (info.kind === 'forbidden') {
    return (
      <Alert
        title={t('save-dashboards.forbidden.title', 'You do not have permission to save this dashboard')}
        severity="error"
      >
        <p>{info.message}</p>
      </Alert>
    );
  }

  if (info.kind === 'invalid') {
    return (
      <Alert title={t('save-dashboards.invalid.title', 'This dashboard is not valid')} severity="error">
        {info.causes.length > 0 ? (
          <ul>
            {info.causes.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
        ) : (
          <p>{info.message}</p>
        )}
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
      <p>{info.message}</p>
    </Alert>
  );
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
