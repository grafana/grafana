import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { FrontendSearcher } from './frontend';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';
import { UnifiedSearcher } from './unified';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const sqlSearcher = new SQLSearcher();

    const useBluge = config.featureToggles.panelTitleSearch;
    searcher = useBluge ? new BlugeSearcher(sqlSearcher) : sqlSearcher;
    if (useBluge && window.location.search.includes('do-frontend-query')) {
      return new FrontendSearcher(searcher);
    }

    const useUnifiedStorageSearch = config.featureToggles.unifiedStorageSearchUI;
    searcher = useUnifiedStorageSearch ? new UnifiedSearcher(sqlSearcher) : sqlSearcher;
  }
  return searcher!;
}
