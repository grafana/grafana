import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const useBluge =
      config.featureToggles.panelTitleSearch && // set in system configs
      window.location.search.indexOf('index=sql') < 0; // or URL override
    searcher = useBluge ? new BlugeSearcher() : new SQLSearcher();
  }
  return searcher!;
}
