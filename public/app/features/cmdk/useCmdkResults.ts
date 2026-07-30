import { useEffect, useMemo, useState } from 'react';

import { buildSectionResults, type CmdkSectionResults, type SourceQueryState } from './results';
import { type CmdkItem, type CmdkSource } from './types';

/**
 * Queries all active sources with the current query (including the initial empty query for static sources) and
 * groups the results into sections. Previous results of a source are kept visible while its new query is in flight
 * to prevent flicker. Query errors are treated as no results for now. Bumping refreshToken re-queries the sources
 * with the same query, for actions that mutate state the items depend on (like selecting scopes).
 */
export function useCmdkResults(sources: CmdkSource[], searchQuery: string, refreshToken = 0): CmdkSectionResults[] {
  const [states, setStates] = useState<ReadonlyMap<CmdkSource, SourceQueryState>>(new Map());

  useEffect(() => {
    const controller = new AbortController();

    setStates((prev) => {
      const next = new Map<CmdkSource, SourceQueryState>();
      for (const source of sources) {
        next.set(source, { items: prev.get(source)?.items ?? [], loading: true });
      }
      return next;
    });

    async function run(source: CmdkSource) {
      let items: CmdkItem[];
      try {
        items = await source.query(searchQuery, controller.signal);
      } catch {
        items = [];
      }
      // A source may resolve after a newer query started or the palette closed; the newer effect owns the state.
      if (controller.signal.aborted) {
        return;
      }
      setStates((prev) => {
        const next = new Map(prev);
        next.set(source, { items, loading: false });
        return next;
      });
    }

    for (const source of sources) {
      run(source);
    }

    return () => {
      controller.abort();
    };
  }, [sources, searchQuery, refreshToken]);

  return useMemo(() => buildSectionResults(sources, states), [sources, states]);
}
