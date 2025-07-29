import { config } from '@grafana/runtime';
import { PermissionLevelString } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { useFoldersQueryLegacy } from './useFoldersQueryLegacy';

export function useFoldersQuery(
  isBrowsing: boolean,
  openFolders: Record<string, boolean>,
  permission?: PermissionLevelString
) {
  const resultLegacy = useFoldersQueryLegacy(isBrowsing, openFolders, permission);
  const resultAppPlatform = useFoldersQueryAppPlatform(isBrowsing, openFolders);

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultAppPlatform : resultLegacy;
}
