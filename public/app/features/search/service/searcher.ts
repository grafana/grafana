import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { FrontendSearcher } from './frontend';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const sqlSearcher = new SQLSearcher();
    const useBluge = config.featureToggles.panelTitleSearch;
    searcher = useBluge ? new BlugeSearcher(sqlSearcher) : sqlSearcher;

    if (useBluge && location.search.includes('do-frontend-query')) {
      searcher = new FrontendSearcher(searcher);
    }
  }
  return searcher!;
}
