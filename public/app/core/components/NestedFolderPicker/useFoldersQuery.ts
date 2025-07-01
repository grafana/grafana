import { config } from '@grafana/runtime';

import { PermissionLevelString } from '../../../types';

import { useFoldersQueryV1 } from './useFoldersQueryV1';
import { useFoldersQueryV2 } from './useFoldersQueryV2';

export function useFoldersQuery(
  isBrowsing: boolean,
  openFolders: Record<string, boolean>,
  permission?: PermissionLevelString
) {
  const resultv1 = useFoldersQueryV1(isBrowsing, openFolders, permission);
  const resultv2 = useFoldersQueryV2(isBrowsing, openFolders);

  // Running the hooks themselves don't have any side effects, so we can just conditionally use one or the other
  // requestNextPage function from the result
  return config.featureToggles.foldersAppPlatformAPI ? resultv2 : resultv1;
}
