import { memo } from 'react';

import { Stack } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
import { ViewRepositoryButton } from 'app/features/provisioning/components/ViewRepositoryButton';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { type DashboardViewItem } from 'app/features/search/types';
import { type FolderDTO } from 'app/types/folders';

export interface Props {
  folder?: FolderDTO | DashboardViewItem;
  /** When true, render a "View repository" link next to the badge. Opt-in so the folder picker dropdown stays non-interactive. */
  enableRepositoryLink?: boolean;
}

export const FolderRepo = memo(function FolderRepo({ folder, enableRepositoryLink = false }: Props) {
  // Check if we can skip early without needing the useIsProvisionedInstance query
  // This reduces RTK Query subscriptions and prevents re-render loops on API errors
  const canSkipEarly = getCanSkipEarly(folder);

  const isProvisionedInstance = useIsProvisionedInstance({ skip: canSkipEarly });
  const skipRender = canSkipEarly || isProvisionedInstance;

  const { isReadOnlyRepo, repoType, repository, status } = useGetResourceRepositoryView({
    folderName: skipRender ? undefined : folder?.uid,
    skipQuery: skipRender,
  });

  if (skipRender) {
    return null;
  }

  const isOrphaned = status === RepoViewStatus.Orphaned;

  if (isOrphaned) {
    return <ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />;
  }

  return (
    // badge with text and icon only has different height, we will need to adjust the layout using stretch
    <Stack direction="row" alignItems="stretch">
      {isReadOnlyRepo && <ReadOnlyBadge repoType={repoType} />}
      <ManagedBadge managerKind={ManagerKind.Repo} name={repository?.title || repository?.name} />
      {enableRepositoryLink && <ViewRepositoryButton repositoryName={repository?.name} />}
    </Stack>
  );
});

// Check conditions that don't require the useIsProvisionedInstance hook
function getCanSkipEarly(folder: FolderDTO | DashboardViewItem | undefined): boolean {
  if (!folder) {
    return true;
  }
  // Skip render if parentUID is present - we only display icon for root folders
  const hasParent = Boolean('parentUID' in folder && folder.parentUID);
  if (hasParent) {
    return true;
  }
  const isNotManaged = !isItemManagedByRepository(folder);
  if (isNotManaged) {
    return true;
  }
  return false;
}
