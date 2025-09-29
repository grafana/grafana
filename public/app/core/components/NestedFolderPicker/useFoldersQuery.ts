import { config } from '@grafana/runtime';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { PermissionLevelString } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevelString;
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
}: UseFoldersQueryProps) {
  const resultLegacy = useFoldersQueryLegacy({ isBrowsing, openFolders, permission, rootFolderUID, rootFolderItem });
  const resultAppPlatform = useFoldersQueryAppPlatform({ isBrowsing, openFolders, rootFolderUID, rootFolderItem });

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
