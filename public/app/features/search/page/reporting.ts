import { reportInteraction } from '@grafana/runtime';
import { InspectTab } from 'app/features/inspector/types';

import { EventTrackingNamespace, SearchLayout } from '../types';

interface QueryProps {
  layout: SearchLayout;
  starred: boolean;
  sortValue?: string;
  query: string;
  tagCount: number;
  includePanels?: boolean;
  deleted: boolean;
}

export const reportDashboardListViewed = (eventTrackingNamespace: EventTrackingNamespace, query: QueryProps) => {
  reportInteraction(`${eventTrackingNamespace}_viewed`, getQuerySearchContext(query));
};

export const reportSearchResultInteraction = (eventTrackingNamespace: EventTrackingNamespace, query: QueryProps) => {
  reportInteraction(`${eventTrackingNamespace}_result_clicked`, getQuerySearchContext(query));
};

export const reportSearchQueryInteraction = (eventTrackingNamespace: EventTrackingNamespace, query: QueryProps) => {
  reportInteraction(`${eventTrackingNamespace}_query_submitted`, getQuerySearchContext(query));
};

export const reportSearchFailedQueryInteraction = (
  eventTrackingNamespace: EventTrackingNamespace,
  { error, ...query }: QueryProps & { error?: string }
) => {
  reportInteraction(`${eventTrackingNamespace}_query_failed`, { ...getQuerySearchContext(query), error });
};

export const reportPanelInspectInteraction = (
  PanelInspectType: InspectTab,
  name: string,
  properties?: Record<string, boolean | string>
) => {
  reportInteraction(`grafana_panel_inspect_${PanelInspectType}_${name}_clicked`, properties);
};

const getQuerySearchContext = (query: QueryProps) => {
  return {
    layout: query.layout,
    starredFilter: query.starred ?? false,
    sort: query.sortValue ?? '',
    tagCount: query.tagCount ?? 0,
    queryLength: query.query?.length ?? 0,
    includePanels: query.includePanels ?? false,
    deleted: query.deleted ?? false,
  };
};
