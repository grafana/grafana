import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { useFlagDashboardVectorSearch, useFlagGrafanaVectorSearchCmdk } from '@grafana/runtime/internal';
import { getDeepSearchResults } from 'app/features/commandPalette/actions/deepSearchActions';

import { registerCmdkSource } from '../registry';
import { type CmdkItem, type CmdkSource } from '../types';

const MAX_DEEP_SEARCH_RESULTS = 5;

// Vector search is slower than the keyword search, so wait longer before firing.
const DEEP_SEARCH_DEBOUNCE_MS = 500;

// Below everything else so the semantic matches don't push exact keyword matches around.
export const DEEP_SEARCH_PRIORITY = 0;

// Section id matches the old palette's sectionId slug so analytics stay comparable.
export const SECTION_DEEP_SEARCH = 'deep-search';

// Resolves after ms, or as soon as the signal aborts (the caller checks aborted afterwards).
function debounceWait(ms: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    abortSignal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

/**
 * Semantic (vector) dashboard search. Reuses the old palette's getDeepSearchResults which queries the vector
 * endpoint with panel-level matches and groups them per dashboard; here the dashboards render as regular items
 * in their own section instead of the old separate column.
 */
export function createDeepSearchSource(): CmdkSource {
  return {
    providedSections: [
      { id: SECTION_DEEP_SEARCH, title: t('command-palette.section.deep-search', 'Dashboards deep search') },
    ],

    async query(query, abortSignal): Promise<CmdkItem[]> {
      if (query.trim().length === 0) {
        return [];
      }

      await debounceWait(DEEP_SEARCH_DEBOUNCE_MS, abortSignal);
      if (abortSignal.aborted) {
        return [];
      }

      let results;
      try {
        results = await getDeepSearchResults(query, abortSignal);
      } catch (error) {
        if (abortSignal.aborted) {
          return [];
        }
        // The vector backend may be unconfigured (501) or the feature toggle off (404) — registration gates on
        // the toggles, so degrade to an empty section but log for anyone hitting this without the gate.
        console.error('Deep search failed. The vector search backend may be unavailable.', error);
        return [];
      }

      return results.slice(0, MAX_DEEP_SEARCH_RESULTS).map(
        (result): CmdkItem => ({
          type: 'navigation',
          id: `deep-search/${result.dashboardUid}`,
          sectionId: SECTION_DEEP_SEARCH,
          title: result.title,
          priority: DEEP_SEARCH_PRIORITY,
          href: result.url,
          subtitle: result.folderTitle,
          tags: result.tags,
        })
      );
    },
  };
}

export function useRegisterDeepSearchSource() {
  // Both the backend vector-search endpoint flag and the command-palette flag must be on.
  const dashboardVectorSearchEnabled = useFlagDashboardVectorSearch();
  const vectorSearchCmdkEnabled = useFlagGrafanaVectorSearchCmdk();
  const enabled = dashboardVectorSearchEnabled && vectorSearchCmdkEnabled;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return registerCmdkSource(createDeepSearchSource());
  }, [enabled]);
}
