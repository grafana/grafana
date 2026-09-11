import { config } from '@grafana/runtime';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type FolderNavigationPurpose } from 'app/features/folders/api/accessibleFolderTree';
import { type PermissionLevel } from 'app/types/acl';

import { useFoldersQueryAccessible } from './useFoldersQueryAccessible';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevel;
  purpose?: FolderNavigationPurpose;
  rootFolderUID?: string;
  rootFolderItem?: DashboardsTreeItem;
}

export function useFoldersQuery({
  isBrowsing,
  openFolders,
  permission,
  /* Start tree from this folder instead of root */
  rootFolderUID,
  rootFolderItem,
  purpose,
}: UseFoldersQueryProps) {
  const resultLegacy = useFoldersQueryLegacy({ isBrowsing, openFolders, permission, rootFolderUID, rootFolderItem });
  const resultAccessible = useFoldersQueryAccessible({
    isBrowsing,
    openFolders,
    permission,
    rootFolderUID,
    rootFolderItem,
    purpose,
  });

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultAccessible : resultLegacy;
}
