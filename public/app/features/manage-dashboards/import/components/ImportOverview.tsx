import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Spinner, Stack } from '@grafana/ui';
import { isDashboardV1Spec, isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { ProvisionedImportOverview } from 'app/features/provisioning/components/Dashboards/ProvisionedImportOverview';
import { RepoInvalidStateBanner } from 'app/features/provisioning/components/Shared/RepoInvalidStateBanner';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type DashboardInputs, type DashboardSource } from '../../types';

import { ImportOverviewV1 } from './ImportOverviewV1';
import { ImportOverviewV2 } from './ImportOverviewV2';

type Props = {
  dashboard: unknown;
  dashboardUid?: string;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  onCancel: () => void;
};

export function ImportOverview({ dashboard, dashboardUid, inputs, meta, source, onCancel }: Props) {
  const searchObj = locationService.getSearchObject();
  const folderUid = searchObj.folderUid ? String(searchObj.folderUid) : '';

  const { repository, folder, status } = useGetResourceRepositoryView({ folderName: folderUid });

  // While detecting provisioning status, show a spinner
  if (status === RepoViewStatus.Loading) {
    return (
      <Stack justifyContent="center">
        <Spinner />
      </Stack>
    );
  }

  // Provisioned folder with an active repository → provisioned import flow
  if (status === RepoViewStatus.Ready && repository && (isDashboardV2Spec(dashboard) || isDashboardV1Spec(dashboard))) {
    return (
      <ProvisionedImportOverview
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        repository={repository}
        folder={folder}
        onCancel={onCancel}
      />
    );
  }
  // Error or orphaned state — block import to avoid inconsistent state
  if (status === RepoViewStatus.Orphaned) {
    return <RepoInvalidStateBanner noRepository isReadOnlyRepo={false} />;
  }

  if (status === RepoViewStatus.Error) {
    return (
      <Alert
        title={t('import-overview.error-provisioning-status-title', 'Unable to determine provisioning status')}
        severity="error"
      >
        <Trans i18nKey="import-overview.error-provisioning-status">
          Could not check whether the target folder is managed by a repository. Please try again or contact an
          administrator.
        </Trans>
      </Alert>
    );
  }

  // Standard import flow
  if (isDashboardV2Spec(dashboard)) {
    return (
      <ImportOverviewV2
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        onCancel={onCancel}
      />
    );
  }

  if (isDashboardV1Spec(dashboard)) {
    return (
      <ImportOverviewV1
        dashboard={dashboard}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Alert
      severity="error"
      title={t('manage-dashboards.import-overview.invalid-schema-title', 'Invalid or unknown dashboard schema')}
      onRemove={onCancel}
      buttonContent={
        <Trans i18nKey="manage-dashboards.import-overview.invalid-schema-action">Try another dashboard</Trans>
      }
    >
      <Trans i18nKey="manage-dashboards.import-overview.invalid-schema-body">
        The dashboard could not be imported because its schema is not a recognized version.
      </Trans>
    </Alert>
  );
}
