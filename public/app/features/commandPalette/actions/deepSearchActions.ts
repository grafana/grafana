import debounce from 'debounce-promise';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { type DeepSearchPanelResult, searchDashboardVector } from '../api/deepSearch';

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
  /** Dashboard tags, parsed from the matched panel snippet. */
  tags: string[];
  /** Up to MAX_SNIPPETS_PER_DASHBOARD matched panel texts, best match first. */
  snippets: string[];
  /** Total panel-level matches for this dashboard (can exceed snippets shown). */
  matchedPanelCount: number;
  /** Lowest cosine distance among this dashboard's matches (lower = closer). */
  bestScore: number;
}

// Separator the backend uses to join the snippet breadcrumb
// (folderTitle → dashboardTitle → rowName → panelTitle → description).
const BREADCRUMB_SEPARATOR = ' → ';
// The backend appends dashboard tags as a dedicated "Tags: a, b" line.
const TAGS_LINE_PREFIX = 'Tags: ';

/** Parses dashboard tags out of a snippet's "Tags: a, b" line, if present. */
function parseSnippetTags(content: string): string[] {
  const line = content.split('\n').find((l) => l.startsWith(TAGS_LINE_PREFIX));
  if (!line) {
    return [];
  }
  return line
    .slice(TAGS_LINE_PREFIX.length)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Cleans a snippet for display. Drops the "Tags:" line (tags are rendered as
 * pills on the card) and the leading folder/dashboard-title breadcrumb segments
 * (already shown as the card header + subtitle, so repeating them is noise).
 * Titles can contain " — " but never the " → " breadcrumb separator, so each is
 * exactly one segment: the folder segment equals the resolved folder title, and
 * the dashboard segment is the prefix of the card title (which is
 * `dashboardTitle — panelTitle`). Row name, panel title and queries are kept.
 * Snippets that don't match (e.g. the mock) are returned unchanged.
 */
function formatSnippet(snippet: string, cardTitle: string, folderTitle?: string): string {
  const lines = snippet.split('\n').filter((line) => !line.startsWith(TAGS_LINE_PREFIX));
  if (lines.length === 0) {
    return '';
  }

  const segments = lines[0].split(BREADCRUMB_SEPARATOR);
  let start = 0;
  while (start < segments.length) {
    const segment = segments[start];
    const isFolder = folderTitle !== undefined && segment === folderTitle;
    const isDashboard = segment === cardTitle || cardTitle.startsWith(segment + ' — ');
    if (!isFolder && !isDashboard) {
      break;
    }
    start++;
  }

  if (start > 0) {
    lines[0] = segments.slice(start).join(BREADCRUMB_SEPARATOR);
  }
  // If the whole breadcrumb was redundant, drop the now-empty first line
  return (lines[0] === '' ? lines.slice(1) : lines).join('\n');
}

/**
 * Groups panel-level search results into one entry per dashboard, ranked by
 * number of matched panels (desc), then by best score (asc). Results arrive
 * ordered by ascending distance, so the first hits per dashboard are its best
 * ones — snippet order relies on that.
 */
export function groupDeepSearchResults(results: DeepSearchPanelResult[]): DeepSearchDashboardResult[] {
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
        // Tags are dashboard-level, so the same on every panel snippet — take the first
        tags: parseSnippetTags(result.content),
        snippets: [],
        matchedPanelCount: 0,
        bestScore: result.score,
      };
      byDashboard.set(result.dashboardUid, group);
    }

    group.matchedPanelCount += 1;
    group.bestScore = Math.min(group.bestScore, result.score);
    if (group.snippets.length < MAX_SNIPPETS_PER_DASHBOARD && result.content) {
      const text = formatSnippet(result.content, result.dashboardTitle, result.folderTitle);
      if (text) {
        group.snippets.push(text);
      }
    }
  }

  return [...byDashboard.values()].sort(
    (a, b) => b.matchedPanelCount - a.matchedPanelCount || a.bestScore - b.bestScore
  );
}

/**
 * Resolves folder titles for results that only carry a folder UID (the core
 * endpoint returns the UID, not the title). Uses the searcher's folder lookup,
 * which loads every folder once and caches it, so this adds no per-query request
 * after the first call. Results that already have a title (e.g. the mock) are
 * left untouched, which also keeps the lookup from firing for them.
 */
async function resolveFolderTitles(results: DeepSearchPanelResult[]): Promise<DeepSearchPanelResult[]> {
  const needsLookup = results.some((result) => !result.folderTitle && result.folderUid);
  if (!needsLookup) {
    return results;
  }

  let locationInfo: Record<string, { name: string }> = {};
  try {
    locationInfo = await getGrafanaSearcher().getLocationInfo();
  } catch (error) {
    // Folder titles are a nice-to-have subtitle; if the lookup fails just omit them
    return results;
  }

  return results.map((result) =>
    result.folderTitle || !result.folderUid ? result : { ...result, folderTitle: locationInfo[result.folderUid]?.name }
  );
}

export async function getDeepSearchResults(query: string): Promise<DeepSearchDashboardResult[]> {
  if (query.trim().length === 0) {
    return [];
  }

  const results = await searchDashboardVector(query, { limit: DEEP_SEARCH_FETCH_LIMIT });
  const withFolderTitles = await resolveFolderTitles(results);
  return groupDeepSearchResults(withFolderTitles);
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
        // The vector backend may be unconfigured (501) or the feature toggle
        // off (404) — callers gate on the toggle via the enabled flag, so
        // degrade to an empty column but log for anyone calling without the gate
        console.error('Deep search failed. The vector search backend may be unavailable.', error);
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
