import { type GrafanaSearcher } from './types';
import { UnifiedSearcher } from './unified';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    searcher = new UnifiedSearcher();
  }
  return searcher!;
}
