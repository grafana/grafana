import debounce from 'debounce-promise';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { type DeepSearchPanelResult, searchDashboardVector } from '../api/deepSearch';

// Results are panel-level, so fetch well past the per-dashboard display count
// to give grouping enough hits to rank dashboards by match count
export const DEEP_SEARCH_FETCH_LIMIT = 50;
export const MAX_SNIPPETS_PER_DASHBOARD = 3;

// Relative-to-best cutoff for 'global' scope (scores are cosine distance, 0 = best):
// keep panels whose distance is within this margin of the closest match.
const RELEVANCE_MARGIN = 0.2;

// Vector search is slower than the keyword search (200ms debounce), so wait
// longer before firing — the deep column loads independently anyway
const DEEP_SEARCH_DEBOUNCE_MS = 500;

/** A single matched panel shown under a dashboard card. */
export interface DeepSearchSnippet {
  text: string;
  /** Cosine distance for this panel match (lower = closer). */
  score: number;
}

/** One dashboard in the deep search column, aggregated from its panel-level matches. */
export interface DeepSearchDashboardResult {
  dashboardUid: string;
  title: string;
  url: string;
  folderTitle?: string;
  /** Dashboard tags, parsed from the matched panel snippet. */
  tags: string[];
  /** Up to MAX_SNIPPETS_PER_DASHBOARD matched panel snippets, best match first. */
  snippets: DeepSearchSnippet[];
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
 * Cleans a snippet for display. The backend content is a breadcrumb line
 * (folder → dashboard → row → panel → description) followed by a "Tags:" line
 * and the raw query expressions. We keep only the breadcrumb — tags render as
 * pills, and raw queries add little value in the palette — and drop the leading
 * folder/dashboard-title segments from it (already shown as the card header +
 * subtitle, so repeating them is noise). Titles can contain " — " but never the
 * " → " breadcrumb separator, so each is exactly one segment: the folder segment
 * equals the resolved folder title, and the dashboard segment is the prefix of
 * the card title (which is `dashboardTitle — panelTitle`). Row name and panel
 * title are kept. Snippets without a breadcrumb (e.g. the mock) pass through.
 */
function formatSnippet(snippet: string, cardTitle: string, folderTitle?: string): string {
  const segments = snippet.split('\n')[0].split(BREADCRUMB_SEPARATOR);

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

  return segments.slice(start).join(BREADCRUMB_SEPARATOR);
}

/**
 * Extracts the bare dashboard title from a hit. The hit title is
 * `dashboardTitle — panelTitle`, but the card only wants the dashboard name.
 * The breadcrumb's first line holds each title as its own " → " segment, and
 * the dashboard title is the one segment that is a prefix of the hit title
 * (folder/row/panel/description segments are not). Falls back to the hit title
 * when there's no breadcrumb to parse (e.g. the mock).
 */
function extractDashboardTitle(content: string, hitTitle: string): string {
  const segments = content.split('\n')[0].split(BREADCRUMB_SEPARATOR);
  const dashboardSegment = segments.find((segment) => segment === hitTitle || hitTitle.startsWith(segment + ' — '));
  return dashboardSegment ?? hitTitle;
}

/**
 * Relative-to-best cutoff over a set of distance scores (0 = best): the closest
 * match plus RELEVANCE_MARGIN. Keeps panels comparable to the best result and
 * drops the long tail, while adapting to query difficulty (a hard query with a
 * worse best score still keeps a band around it). The best panel always survives.
 */
function relativeToBestCutoff(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  return Math.min(...scores) + RELEVANCE_MARGIN;
}

/**
 * Groups panel-level search results into one entry per dashboard. Dashboards are
 * kept in backend order — i.e. the position where each dashboard's first (best)
 * panel hit appears — since the backend returns hits in ascending-distance order
 * and the Map preserves first-insertion order.
 *
 * Panels worse (higher distance) than the cutoff are dropped entirely. The cutoff is
 * relative-to-best over all matched panels (best + margin). The best panel
 * always survives (its score can't exceed either cutoff). Dashboard disappears
 * if its best panel is more than a margin past the overall best. Surviving snippets
 * are sorted by score and capped at MAX_SNIPPETS_PER_DASHBOARD; matchedPanelCount
 * counts all survivors.
 */
export function groupDeepSearchResults(results: DeepSearchPanelResult[]): DeepSearchDashboardResult[] {
  const matched = results.filter((result) => result.dashboardUid);
  const globalCutoff = relativeToBestCutoff(matched.map((result) => result.score));

  // Group panels per dashboard, preserving backend (first-appearance) order
  const byDashboard = new Map<string, DeepSearchPanelResult[]>();
  for (const result of matched) {
    const panels = byDashboard.get(result.dashboardUid);
    if (panels) {
      panels.push(result);
    } else {
      byDashboard.set(result.dashboardUid, [result]);
    }
  }

  const groups: DeepSearchDashboardResult[] = [];
  for (const panels of byDashboard.values()) {
    const kept = panels.filter((panel) => panel.score <= globalCutoff);
    if (kept.length === 0) {
      continue;
    }

    // Backend order is ascending distance, so the first kept panel is the best
    const best = kept[0];
    const snippets = kept
      .map((panel) => ({
        text: formatSnippet(panel.content, panel.dashboardTitle, panel.folderTitle),
        score: panel.score,
      }))
      .filter((snippet) => snippet.text)
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_SNIPPETS_PER_DASHBOARD);

    groups.push({
      dashboardUid: best.dashboardUid,
      title: extractDashboardTitle(best.content, best.dashboardTitle),
      url: `/d/${best.dashboardUid}`,
      folderTitle: best.folderTitle,
      // Tags are dashboard-level, so the same on every panel snippet — take the best panel's
      tags: parseSnippetTags(best.content),
      snippets,
      matchedPanelCount: kept.length,
      bestScore: best.score,
    });
  }

  return groups;
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
    // TODO: this relies on getGrafanaSearcher doing this lookup at instantiation. It loads 10k folders to create this
    //  map so customers with more folders won't get the full mapping.
    locationInfo = await getGrafanaSearcher().getLocationInfo();
  } catch (error) {
    // If the lookup fails, just omit them for now.
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
