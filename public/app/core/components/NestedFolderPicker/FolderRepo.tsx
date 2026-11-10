import { memo } from 'react';

import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { ensureFolderPathTrailingSlash } from 'app/features/provisioning/components/utils/path';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { isItemManagedByRepository, type ManagedResourceItem } from 'app/features/provisioning/utils/managedResource';

export interface Props {
  folder?: ManagedResourceItem;
  /** When true, the badge exposes repository actions (source folder, repository admin). Opt-in so the folder picker dropdown stays non-interactive. */
  enableRepositoryLink?: boolean;
  /** The folder's path within its repository (`grafana.app/sourcePath`); with `enableRepositoryLink`, the badge links to it. */
  sourcePath?: string;
}

export const FolderRepo = memo(function FolderRepo({ folder, enableRepositoryLink = false, sourcePath }: Props) {
  const showBadge = isItemManagedByRepository(folder);
  // The item's manager id names the repository directly, so no folder resource has to be fetched
  // per row. Items from the legacy folder APIs carry no id: `includeInstance` keeps the settings
  // lookup alive for them so instance-managed setups still hide the badge, and they fall back to
  // the generic repository badge.
  const { isReadOnlyRepo, repository, status, isInstanceManaged } = useGetResourceRepositoryView({
    name: showBadge ? folder?.managerId : undefined,
    includeInstance: showBadge,
  });

  if (!showBadge || isInstanceManaged) {
    return null;
  }

  if (status === RepoViewStatus.Orphaned) {
    return <ManagedBadge managerKind={ManagerKind.Repo} isOrphaned />;
  }

  return (
    <ManagedBadge
      managerKind={ManagerKind.Repo}
      name={repository?.title || repository?.name}
      repositoryName={enableRepositoryLink ? repository?.name : undefined}
      // Trailing slash marks the path as a directory, so the source link points at the
      // provider's tree view instead of a blob view.
      sourcePath={enableRepositoryLink && sourcePath ? ensureFolderPathTrailingSlash(sourcePath) : undefined}
      // Repository-managed by construction, so the repository's workflows are the whole policy.
      managerAllowsEdits={!isReadOnlyRepo}
    />
  );
});
