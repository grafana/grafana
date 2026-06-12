import { memo } from 'react';

import { Stack } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { type DashboardViewItem } from 'app/features/search/types';
import { type FolderDTO } from 'app/types/folders';

export interface Props {
  folder?: FolderDTO | DashboardViewItem;
}

export const FolderRepo = memo(function FolderRepo({ folder }: Props) {
  const managedBy = folder?.managedBy;
  const isRepoManaged = managedBy === ManagerKind.Repo;

  // The repository view (read-only/orphaned/title) is only relevant for repository-managed folders.
  // For other managers we still need the hooks to run (rules of hooks) but skip the queries.
  const skipRepoView = !isRepoManaged || getCanSkipEarly(folder);
  const isProvisionedInstance = useIsProvisionedInstance({ skip: skipRepoView });
  const skipQuery = skipRepoView || isProvisionedInstance;

  const { isReadOnlyRepo, repoType, repository, status } = useGetResourceRepositoryView({
    folderName: skipQuery ? undefined : folder?.uid,
    skipQuery,
  });

  // We only display the badge on the managed (root) folder.
  if (!folder || !managedBy || getCanSkipEarly(folder)) {
    return null;
  }

  // Non-repository managers (terraform, kubectl, plugin, ...): a simple managed badge, no repo lookup.
  if (!isRepoManaged) {
    return <ManagedBadge managerKind={managedBy} />;
  }

  // Whole instance is provisioned — the per-folder badge is handled elsewhere.
  if (isProvisionedInstance) {
    return null;
  }

  if (status === RepoViewStatus.Orphaned) {
    return <ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />;
  }

  return (
    // badge with text and icon only has different height, we will need to adjust the layout using stretch
    <Stack direction="row" alignItems="stretch">
      {isReadOnlyRepo && <ReadOnlyBadge repoType={repoType} />}
      <ManagedBadge managerKind={ManagerKind.Repo} name={repository?.title || repository?.name} />
    </Stack>
  );
});

// Skip rendering for the root-folder-only cases that don't require the useIsProvisionedInstance query.
function getCanSkipEarly(folder: FolderDTO | DashboardViewItem | undefined): boolean {
  if (!folder) {
    return true;
  }
  // We only display the badge for root folders
  return Boolean('parentUID' in folder && folder.parentUID);
}
