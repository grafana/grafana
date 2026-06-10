import debounce from 'debounce-promise';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type DashboardMemorySearchResult, searchDashboardMemory } from '../api/deepSearch';

// Results are panel-level, so fetch well past the per-dashboard display count
// to give grouping enough hits to rank dashboards by match count
export const DEEP_SEARCH_FETCH_LIMIT = 50;
export const MAX_SNIPPETS_PER_DASHBOARD = 3;
// Vector search is slower than the keyword search (200ms debounce), so wait
// longer before firing — the deep column loads independently anyway
const DEEP_SEARCH_DEBOUNCE_MS = 500;

/** One dashboard in the deep search column, aggregated from its panel-level matches. */
export interface DeepSearchDashboardResult {
  dashboardUid: string;
  title: string;
  url: string;
  folderTitle?: string;
  /** Up to MAX_SNIPPETS_PER_DASHBOARD matched panel texts, best match first. */
  snippets: string[];
  /** Total panel-level matches for this dashboard (can exceed snippets shown). */
  matchedPanelCount: number;
  /** Lowest cosine distance among this dashboard's matches (lower = closer). */
  bestScore: number;
}

/**
 * Groups panel-level memory search results into one entry per dashboard,
 * ranked by number of matched panels (desc), then by best score (asc).
 * Results arrive ordered by ascending distance, so the first hits per
 * dashboard are its best ones — snippet order relies on that.
 */
export function groupDashboardMemoryResults(results: DashboardMemorySearchResult[]): DeepSearchDashboardResult[] {
  const byDashboard = new Map<string, DeepSearchDashboardResult>();

  for (const result of results) {
    if (!result.dashboardUid) {
      continue;
    }

    let group = byDashboard.get(result.dashboardUid);
    if (!group) {
      group = {
        dashboardUid: result.dashboardUid,
        title: result.dashboardTitle,
        url: `/d/${result.dashboardUid}`,
        folderTitle: result.folderTitle,
        snippets: [],
        matchedPanelCount: 0,
        bestScore: result.score,
      };
      byDashboard.set(result.dashboardUid, group);
    }

    group.matchedPanelCount += 1;
    group.bestScore = Math.min(group.bestScore, result.score);
    if (group.snippets.length < MAX_SNIPPETS_PER_DASHBOARD && result.content) {
      group.snippets.push(result.content);
    }
  }

  return [...byDashboard.values()].sort(
    (a, b) => b.matchedPanelCount - a.matchedPanelCount || a.bestScore - b.bestScore
  );
}

export async function getDeepSearchResults(query: string): Promise<DeepSearchDashboardResult[]> {
  if (query.trim().length === 0) {
    return [];
  }

  const results = await searchDashboardMemory(query, { limit: DEEP_SEARCH_FETCH_LIMIT });
  return groupDashboardMemoryResults(results);
}

interface UseDeepSearchResultsOptions {
  searchQuery: string;
  /** False while the palette shows a sub-category — deep results only apply at the root. */
  show: boolean;
  /** Gate on assistant availability; when false no requests fire and results stay empty. */
  enabled: boolean;
}

/**
 * Semantic dashboard search for the deep search palette column. Mirrors
 * useSearchResults but debounces longer and reports its own fetching flag so
 * the deep column loads independently of the fast keyword results.
 */
export function useDeepSearchResults({ searchQuery, show, enabled }: UseDeepSearchResultsOptions) {
  const [deepSearchResults, setDeepSearchResults] = useState<DeepSearchDashboardResult[]>([]);
  const [isFetchingDeepSearchResults, setIsFetchingDeepSearchResults] = useState(false);
  const lastSearchTimestamp = useRef<number>(0);

  const debouncedDeepSearch = useMemo(() => debounce(getDeepSearchResults, DEEP_SEARCH_DEBOUNCE_MS), []);

  useEffect(() => {
    const timestamp = Date.now();

    if (!enabled || !show || searchQuery.length === 0) {
      setDeepSearchResults([]);
      setIsFetchingDeepSearchResults(false);
      lastSearchTimestamp.current = timestamp;
      return;
    }

    let cancelled = false;

    const search = async () => {
      setIsFetchingDeepSearchResults(true);

      let results: DeepSearchDashboardResult[] = [];
      try {
        results = await debouncedDeepSearch(searchQuery);
      } catch (error) {
        // The endpoint lives in the assistant plugin — callers are expected to
        // gate on its availability via the enabled flag, so degrade to an
        // empty column but log for anyone calling this without the gate
        console.error('Deep search failed. It needs assistant app plugin to be installed.', error);
      }

      // Skip state updates when the effect has been cleaned up, and only keep
      // results issued after the most recently resolved search, so a slow
      // early response can't overwrite a newer one
      if (!cancelled && timestamp > lastSearchTimestamp.current) {
        setDeepSearchResults(results);
        setIsFetchingDeepSearchResults(false);
        lastSearchTimestamp.current = timestamp;
      }
    };
    search();

    return () => {
      cancelled = true;
    };
  }, [enabled, show, searchQuery, debouncedDeepSearch]);

  return { deepSearchResults, isFetchingDeepSearchResults };
}
