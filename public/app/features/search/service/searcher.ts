import { DataFrame, DataFrameView } from '@grafana/data';

import { DashboardSearchItemType, DashboardSectionItem } from '../types';

import { MiniSearcher } from './minisearcher';
import { GrafanaSearcher } from './types';

import { QueryResult } from '.';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    searcher = new MiniSearcher();
  }
  return searcher!;
}

// This is not trying very hard... but should be enough to make things kinda work
export function toDashboardSectionItem(df: DataFrame): DashboardSectionItem[] {
  const view = new DataFrameView<QueryResult>(df);
  return view.map((item) => ({
    uid: item.uid,
    title: item.name,
    url: item.url,
    uri: item.url,
    type: kindToDashboardSectionType(item.kind),
    score: item.score,
    items: [],
    id: 666, // do not use me!
    isStarred: false,
    tags: item.tags ?? [],
  }));
}

function kindToDashboardSectionType(k: string): DashboardSearchItemType {
  return k === 'folder' ? DashboardSearchItemType.DashFolder : DashboardSearchItemType.DashDB;
}
