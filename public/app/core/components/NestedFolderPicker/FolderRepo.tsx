import { memo } from 'react';

import { Stack } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
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
  /** Whether the current user could edit this folder. Only users who could otherwise edit get the read-only badge; the managed badge is shown to everyone. */
  canEdit?: boolean;
}

export const FolderRepo = memo(function FolderRepo({
  folder,
  enableRepositoryLink = false,
  sourcePath,
  canEdit = false,
}: Props) {
  const showBadge = isItemManagedByRepository(folder);
  // The item's manager id names the repository directly, so no folder resource has to be fetched
  // per row. Items from the legacy folder APIs carry no id: `includeInstance` keeps the settings
  // lookup alive for them so instance-managed setups still hide the badge, and they fall back to
  // the generic repository badge.
  const { isReadOnlyRepo, repoType, repository, status, isInstanceManaged } = useGetResourceRepositoryView({
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
    // badge with text and icon only has different height, we will need to adjust the layout using stretch
    <Stack direction="row" alignItems="stretch">
      {canEdit && isReadOnlyRepo && <ReadOnlyBadge repoType={repoType} />}
      <ManagedBadge
        managerKind={ManagerKind.Repo}
        name={repository?.title || repository?.name}
        repositoryName={enableRepositoryLink ? repository?.name : undefined}
        // Trailing slash marks the path as a directory, so the source link points at the
        // provider's tree view instead of a blob view.
        sourcePath={enableRepositoryLink && sourcePath ? ensureFolderPathTrailingSlash(sourcePath) : undefined}
      />
    </Stack>
  );
});
