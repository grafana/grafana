import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { registerCmdkSource } from '../registry';
import { type CmdkItem, type CmdkSource } from '../types';

const MAX_SEARCH_RESULTS = 100;
const SEARCH_DEBOUNCE_MS = 500;

// Below the static items priorities so the list doesn't 'jump' when the async results come in.
export const SEARCH_RESULTS_PRIORITY = 1;

// Section ids match the old palette's sectionId slugs so analytics stay comparable.
export const SECTION_FOLDERS = 'folders';
export const SECTION_DASHBOARDS = 'dashboards';

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
 * Searches dashboards and folders through the Grafana searcher. Debouncing happens here, inside the source:
 * the query waits out the typing burst and bails if the palette aborted it for a newer query in the meantime.
 * Stale responses need no special handling as the palette discards results of aborted queries.
 */
export function createDashboardSearchSource(): CmdkSource {
  return {
    providedSections: [
      { id: SECTION_FOLDERS, title: t('command-palette.section.folder-search-results', 'Folders') },
      { id: SECTION_DASHBOARDS, title: t('command-palette.section.dashboard-search-results', 'Dashboards') },
    ],

    async query(query, abortSignal): Promise<CmdkItem[]> {
      if (query.length === 0 || (!contextSrv.user.isSignedIn && !config.anonymousEnabled)) {
        return [];
      }

      await debounceWait(SEARCH_DEBOUNCE_MS, abortSignal);
      if (abortSignal.aborted) {
        return [];
      }

      const data = await getGrafanaSearcher().search({
        kind: ['dashboard', 'folder'],
        query,
        limit: MAX_SEARCH_RESULTS,
      });

      return data.view.map((result): CmdkItem => {
        const { url, name, kind, location } = result; // items are backed by DataFrameView, so must hold the values in a closure
        return {
          type: 'navigation',
          id: `go/${kind}${url}`,
          sectionId: kind === 'dashboard' ? SECTION_DASHBOARDS : SECTION_FOLDERS,
          title: `${name}`,
          priority: SEARCH_RESULTS_PRIORITY,
          href: url,
          rightSubtitle: data.view.dataFrame.meta?.custom?.locationInfo[location]?.name,
        };
      });
    },
  };
}

export function useRegisterDashboardSearchSource() {
  useEffect(() => registerCmdkSource(createDashboardSearchSource()), []);
}
