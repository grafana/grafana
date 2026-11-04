import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type PermissionLevel } from 'app/types/acl';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';

export interface UseFoldersQueryProps {
  isBrowsing: boolean;
  openFolders: Record<string, boolean>;
  permission?: PermissionLevel;
  rootFolderUID?: string;
  rootFolderItem?: DashboardsTreeItem;
}

export function useFoldersQuery(props: UseFoldersQueryProps) {
  return useFoldersQueryAppPlatform(props);
}
