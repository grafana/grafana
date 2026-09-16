import { useFlagFoldersAppPlatformAPI } from '@grafana/runtime/internal';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';
import { type PermissionLevel } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevel;
  rootFolderUID?: string;
  rootFolderItem?: DashboardsTreeItem;
  folderFilter?: (folder: DashboardViewItem) => boolean;
}

export function useFoldersQuery({
  isBrowsing,
  openFolders,
  permission,
  /* Start tree from this folder instead of root */
  rootFolderUID,
  rootFolderItem,
  folderFilter,
}: UseFoldersQueryProps) {
  const shouldUseAppPlatformAPI = useFlagFoldersAppPlatformAPI();
  const resultLegacy = useFoldersQueryLegacy({
    isBrowsing,
    openFolders,
    permission,
    rootFolderUID,
    rootFolderItem,
    folderFilter,
  });
  const resultAppPlatform = useFoldersQueryAppPlatform({
    isBrowsing,
    openFolders,
    permission,
    rootFolderUID,
    rootFolderItem,
    folderFilter,
  });

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return shouldUseAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
