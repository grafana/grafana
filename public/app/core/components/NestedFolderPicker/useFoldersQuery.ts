import { config } from '@grafana/runtime';
import { PermissionLevelString } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export function useFoldersQuery(
  isBrowsing: boolean,
  openFolders: Record<string, boolean>,
  permission?: PermissionLevelString,
  /* Start tree from this folder instead of root */
  rootFolderUID?: string
) {
  const resultLegacy = useFoldersQueryLegacy(isBrowsing, openFolders, permission, rootFolderUID);
  const resultAppPlatform = useFoldersQueryAppPlatform(isBrowsing, openFolders, rootFolderUID);

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
