import { MiniSearcher } from './minisearcher';
import { GrafanaSearcher } from './types';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    searcher = new MiniSearcher();
  }
  return searcher!;
}
