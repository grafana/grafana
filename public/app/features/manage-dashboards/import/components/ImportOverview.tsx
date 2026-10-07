import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Spinner, Stack } from '@grafana/ui';
import { isDashboardV1Spec, isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { ProvisionedImportOverview } from 'app/features/provisioning/components/Dashboards/ProvisionedImportOverview';
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
  const initialFolderUid = searchObj.folderUid ? String(searchObj.folderUid) : '';
  const [selectedFolderUid, setSelectedFolderUid] = useState(initialFolderUid);

  const { repository, folder, status } = useGetResourceRepositoryView({
    folderName: selectedFolderUid,
    includeInstance: true,
  });

  // While detecting provisioning status, show a spinner
  if (status === RepoViewStatus.Loading) {
    return (
      <Stack justifyContent="center">
        <Spinner />
      </Stack>
    );
  }

  const isRecognizedDashboardSpec = isDashboardV2Spec(dashboard) || isDashboardV1Spec(dashboard);

  // Error/Orphaned route here to fail closed — block standard import into a potentially repo-managed folder.
  if (
    isRecognizedDashboardSpec &&
    ((status === RepoViewStatus.Ready && repository) ||
      status === RepoViewStatus.Orphaned ||
      status === RepoViewStatus.Error)
  ) {
    return (
      <ProvisionedImportOverview
        // RHF defaultValues are mount-only; remount when the target folder changes.
        key={selectedFolderUid}
        dashboard={dashboard}
        dashboardUid={dashboardUid}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={selectedFolderUid}
        status={status}
        repository={repository}
        folder={folder}
        onFolderChange={setSelectedFolderUid}
        onCancel={onCancel}
      />
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
        folderUid={selectedFolderUid}
        onFolderChange={setSelectedFolderUid}
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
        folderUid={selectedFolderUid}
        onFolderChange={setSelectedFolderUid}
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
