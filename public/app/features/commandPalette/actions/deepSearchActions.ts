import { type DashboardMemorySearchResult, searchDashboardMemory } from '../api/deepSearch';

// Results are panel-level, so fetch well past the per-dashboard display count
// to give grouping enough hits to rank dashboards by match count
export const DEEP_SEARCH_FETCH_LIMIT = 50;
export const MAX_SNIPPETS_PER_DASHBOARD = 3;

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
