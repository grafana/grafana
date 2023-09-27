import { DataFrameView, IconName } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardViewItem, DashboardViewItemKind } from '../types';

import { DashboardQueryResult, SearchQuery, SearchResultMeta } from './types';

/** prepare the query replacing folder:current */
export async function replaceCurrentFolderQuery(query: SearchQuery): Promise<SearchQuery> {
  if (query.query && query.query.indexOf('folder:current') >= 0) {
    query = {
      ...query,
      location: await getCurrentFolderUID(),
      query: query.query.replace('folder:current', '').trim(),
    };
    if (!query.query?.length) {
      query.query = '*';
    }
  }
  return Promise.resolve(query);
}

async function getCurrentFolderUID(): Promise<string | undefined> {
  try {
    let dash = getDashboardSrv().getCurrent();
    if (!dash) {
      await delay(500); // may not be loaded yet
      dash = getDashboardSrv().getCurrent();
    }
    return Promise.resolve(dash?.meta?.folderUid);
  } catch (e) {
    console.error(e);
  }
  return undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (kind === 'dashboard') {
    return 'apps';
  }

  if (kind === 'folder') {
    return isOpen ? 'folder-open' : 'folder';
  }

  return 'question-circle';
}

function parseKindString(kind: string): DashboardViewItemKind {
  switch (kind) {
    case 'dashboard':
    case 'folder':
    case 'panel':
      return kind;
    default:
      return 'dashboard'; // not a great fallback, but it's the previous behaviour
  }
}

export function queryResultToViewItem(
  item: DashboardQueryResult,
  view?: DataFrameView<DashboardQueryResult>
): DashboardViewItem {
  const meta = view?.dataFrame.meta?.custom as SearchResultMeta | undefined;

  const viewItem: DashboardViewItem = {
    kind: parseKindString(item.kind),
    uid: item.uid,
    title: item.name,
    url: item.url,
    tags: item.tags ?? [],
  };

  // Set enterprise sort value property
  const sortFieldName = meta?.sortBy;
  if (sortFieldName) {
    const sortFieldValue = item[sortFieldName];
    if (typeof sortFieldValue === 'string' || typeof sortFieldValue === 'number') {
      viewItem.sortMetaName = sortFieldName;
      viewItem.sortMeta = sortFieldValue;
    }
  }

  if (item.location) {
    const ancestors = item.location.split('/');
    const parentUid = ancestors[ancestors.length - 1];
    const parentInfo = meta?.locationInfo[parentUid];
    if (parentInfo) {
      viewItem.parentTitle = parentInfo.name;
      viewItem.parentKind = parentInfo.kind;
      viewItem.parentUID = parentUid;
    }
  }

  return viewItem;
}
