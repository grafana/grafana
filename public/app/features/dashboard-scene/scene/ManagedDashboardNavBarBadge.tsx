import { skipToken } from '@reduxjs/toolkit/query';

import { config, isFetchError } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { ViewRepositoryButton } from 'app/features/provisioning/components/ViewRepositoryButton';

import { type DashboardScene } from './DashboardScene';

export const ManagedDashboardNavBarBadge = ({ dashboard }: { dashboard: DashboardScene }) => {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();

  const shouldSkipQuery = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;
  // All other places where we check for orphaned resources (e.g. OrphanedResourceBanner) use
  // useGetResourceRepositoryView. We don't here because it's much heavier than what's needed and
  // also fetches folder data.
  const { data: repoData, isError, error } = useGetRepositoryQuery(shouldSkipQuery ? skipToken : { name: id });

  if (!kind) {
    return null;
  }

  // Repository-managed dashboard where the repo no longer exists
  const isOrphaned = kind === ManagerKind.Repo && isError && isFetchError(error) && error.status === 404;

  return (
    <Stack direction="row" alignItems="center">
      <ManagedBadge managerKind={kind} name={repoData?.spec?.title || id} isOrphaned={isOrphaned} />
      <ViewRepositoryButton repositoryName={kind === ManagerKind.Repo ? id : undefined} isOrphaned={isOrphaned} />
    </Stack>
  );
};
