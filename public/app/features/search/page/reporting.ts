import { config, reportInteraction } from '@grafana/runtime';

import { SearchLayout } from '../types';

interface QueryProps {
  layout: SearchLayout;
  starred: boolean;
  sortValue: string;
  query: string;
  tagCount: number;
  includePanels: boolean;
}

type DashboardListType = 'manage_dashboards' | 'dashboard_search';

export const reportDashboardListViewed = (dashboardListType: DashboardListType, query: QueryProps) => {
  reportInteraction(`${dashboardListType}_viewed`, getQuerySearchContext(query));
};

export const reportSearchResultInteraction = (dashboardListType: DashboardListType, query: QueryProps) => {
  reportInteraction(`${dashboardListType}_result_clicked`, getQuerySearchContext(query));
};

export const reportSearchQueryInteraction = (dashboardListType: DashboardListType, query: QueryProps) => {
  reportInteraction(`${dashboardListType}_query_submitted`, getQuerySearchContext(query));
};

export const reportSearchFailedQueryInteraction = (
  dashboardListType: DashboardListType,
  { error, ...query }: QueryProps & { error?: string }
) => {
  reportInteraction(`${dashboardListType}_query_failed`, { ...getQuerySearchContext(query), error });
};

const getQuerySearchContext = (query: QueryProps) => {
  const showPreviews = query.layout === SearchLayout.Grid;
  const previewsEnabled = Boolean(config.featureToggles.panelTitleSearch);
  const previews = previewsEnabled ? (showPreviews ? 'on' : 'off') : 'feature_disabled';

  return {
    previews,
    layout: query.layout,
    starredFilter: query.starred ?? false,
    sort: query.sortValue ?? '',
    tagCount: query.tagCount ?? 0,
    queryLength: query.query?.length ?? 0,
    includePanels: query.includePanels ?? false,
  };
};
