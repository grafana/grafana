import { locationService } from '@grafana/runtime';
import { Spinner, Stack } from '@grafana/ui';
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
  const folderUid = searchObj.folderUid ? String(searchObj.folderUid) : '';

  const { repository, status } = useGetResourceRepositoryView({ folderName: folderUid });

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

  return null;
}
