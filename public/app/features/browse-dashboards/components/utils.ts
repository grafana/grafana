import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { DashboardViewItemWithUIItems } from '../types';

export function makeRowID(baseId: string, item: DashboardViewItemWithUIItems) {
  return baseId + item.uid;
}

export function isSharedWithMe(uid: string) {
  return uid === config.sharedWithMeFolderUID;
}

// Append orgId to the folder URL
export function getFolderURL(url: string) {
  const { orgId } = contextSrv.user;
  if (orgId) {
    return `${url}?orgId=${orgId}`;
  }
  return url;
}
