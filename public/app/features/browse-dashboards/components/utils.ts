import { config } from '@grafana/runtime';

import { DashboardViewItemWithUIItems } from '../types';

export function makeRowID(baseId: string, item: DashboardViewItemWithUIItems) {
  return baseId + item.uid;
}

export function isSharedWithMe(item: DashboardViewItemWithUIItems | string) {
  if (typeof item === 'string') {
    return item === config.sharedWithMeFolderUID;
  }

  return item.kind === 'folder' && item.uid === config.sharedWithMeFolderUID;
}
