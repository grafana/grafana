import { QueryResultMeta } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DashboardViewItem } from '../types';

import { DashboardQueryResult, SearchQuery } from './types';

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

export function queryResultToViewItem(
  item: DashboardQueryResult,
  queryMeta?: QueryResultMeta // TODO: change this to the view instead
): DashboardViewItem {
  return {
    kind: 'dashboard',
    uid: item.uid,
    title: item.name,
    url: item.url,
    tags: item.tags ?? [],
    folderTitle: queryMeta?.custom?.locationInfo[item.location].name,
  };
}
