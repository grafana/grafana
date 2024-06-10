import { config } from '@grafana/runtime';

import { DashboardViewItemWithUIItems } from '../types';

export function makeRowID(baseId: string, item: DashboardViewItemWithUIItems) {
  return baseId + item.uid;
}

export function isSharedWithMe(uid: string) {
  return uid === config.sharedWithMeFolderUID;
}
