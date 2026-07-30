import { useEffect } from 'react';

import { fuzzySearch } from '@grafana/data';
import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';
import { type DashboardQueryResult } from 'app/features/search/service/types';

import { registerCmdkSource } from '../registry';
import { type CmdkItem, type CmdkSource } from '../types';

const MAX_RECENT_DASHBOARDS = 5;

// Above the static actions so recently viewed dashboards show at the top, like in the old palette.
export const RECENT_DASHBOARDS_PRIORITY = 6;

// Section id matches the old palette's sectionId slug so analytics stay comparable.
export const SECTION_RECENT_DASHBOARDS = 'recent-dashboards';

/**
 * Recently viewed dashboards. The list is fetched when the palette opens (the initial empty query) and reused
 * while typing, mirroring the old palette which fetched once per open. Non-empty queries fuzzy-filter the list
 * inside the source.
 */
export function createRecentDashboardsSource(): CmdkSource {
  let recentDashboards: Promise<DashboardQueryResult[]> | undefined;

  return {
    providedSections: [
      { id: SECTION_RECENT_DASHBOARDS, title: t('command-palette.section.recent-dashboards', 'Recent dashboards') },
    ],

    async query(query, _abortSignal): Promise<CmdkItem[]> {
      if (!contextSrv.user.isSignedIn) {
        return [];
      }

      if (query === '' || !recentDashboards) {
        recentDashboards = getRecentlyViewedDashboards(MAX_RECENT_DASHBOARDS);
      }
      let dashboards = await recentDashboards;

      if (query !== '') {
        const matches = fuzzySearch(
          dashboards.map((dashboard) => dashboard.name),
          query
        );
        dashboards = matches.map((index) => dashboards[index]);
      }

      return dashboards.map((dashboard): CmdkItem => {
        const { url, name } = dashboard; // items are backed by DataFrameView, so must hold the values in a closure
        return {
          type: 'navigation',
          id: `recent-dashboards${url}`,
          sectionId: SECTION_RECENT_DASHBOARDS,
          title: `${name}`,
          priority: RECENT_DASHBOARDS_PRIORITY,
          href: url,
        };
      });
    },
  };
}

export function useRegisterRecentDashboardsSource() {
  useEffect(() => registerCmdkSource(createRecentDashboardsSource()), []);
}
