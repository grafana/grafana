import { config } from '@grafana/runtime';
import { PermissionLevelString } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export function useFoldersQuery({
  isBrowsing,
  openFolders,
  permission,
  /* Start tree from this folder instead of root */
  rootFolderUID,
  rootFolderDisplay,
}: {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevelString;
  rootFolderUID?: string;
  rootFolderDisplay?: string;
}) {
  const resultLegacy = useFoldersQueryLegacy(isBrowsing, openFolders, permission, rootFolderUID, rootFolderDisplay);
  const resultAppPlatform = useFoldersQueryAppPlatform(isBrowsing, openFolders, rootFolderUID, rootFolderDisplay);

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
