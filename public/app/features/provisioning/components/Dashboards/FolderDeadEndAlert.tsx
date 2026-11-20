import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { RepoViewStatus, type RepositoryViewData } from '../../hooks/useGetResourceRepositoryView';

import { FormLoadingErrorAlert } from './FormLoadingErrorAlert';

/** Why a new save's target folder cannot be saved to (picked, or preselected via ?folderUid=); renders nothing unless the lookup is orphaned or failed */
export function FolderDeadEndAlert({ status, error }: Pick<RepositoryViewData, 'status' | 'error'>) {
  if (status === RepoViewStatus.Orphaned) {
    return (
      <Alert
        severity="warning"
        title={t(
          'dashboard-scene.save-dashboard-drawer.folder-repo-missing-title',
          'The selected folder cannot be saved to'
        )}
      >
        <Trans i18nKey="dashboard-scene.save-dashboard-drawer.folder-repo-missing-body">
          The provisioning repository managing this folder no longer exists. Choose a different folder or save at the
          repository root.
        </Trans>
      </Alert>
    );
  }
  if (status === RepoViewStatus.Error) {
    return <FormLoadingErrorAlert error={error} />;
  }
  return null;
}
