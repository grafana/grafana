import { useBooleanFlagValue } from '@openfeature/react-sdk';

import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type PermissionLevel } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevel;
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
  const shouldUseAppPlatformAPI = useBooleanFlagValue('foldersAppPlatformAPI', false);
  const resultLegacy = useFoldersQueryLegacy({ isBrowsing, openFolders, permission, rootFolderUID, rootFolderItem });
  const resultAppPlatform = useFoldersQueryAppPlatform({
    isBrowsing,
    openFolders,
    permission,
    rootFolderUID,
    rootFolderItem,
  });

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return shouldUseAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
