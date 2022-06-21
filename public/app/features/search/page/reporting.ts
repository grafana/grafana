import { config, reportInteraction } from '@grafana/runtime';

import { SearchLayout } from '../types';

export const reportDashboardListViewed = (
  dashboardListType: 'manage_dashboards' | 'dashboard_search',
  query: {
    layout?: SearchLayout;
    starred?: boolean;
    sortValue?: string;
    query?: string;
    tagCount?: number;
  }
) => {
  const showPreviews = query.layout === SearchLayout.Grid;
  const previewsEnabled = Boolean(config.featureToggles.panelTitleSearch);
  const previews = previewsEnabled ? (showPreviews ? 'on' : 'off') : 'feature_disabled';
  reportInteraction(`${dashboardListType}_viewed`, {
    previews,
    layout: query.layout,
    starredFilter: query.starred ?? false,
    sort: query.sortValue ?? '',
    tagCount: query.tagCount ?? 0,
    queryLength: query.query?.length ?? 0,
  });
};
