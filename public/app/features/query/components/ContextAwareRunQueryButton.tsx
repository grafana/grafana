import { useLocation } from 'react-router-dom';

import { DataQuery } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import ExploreRunQueryButton from '../../explore/ExploreRunQueryButton';

import { DashboardRunQueryButton } from './DashboardRunQueryButton';

interface Props {
  queries: DataQuery[];
  rootDatasourceUid?: string;
}

/**
 * Context-aware run query button that renders the appropriate button
 * based on whether we're in Explore or Dashboard context
 */
export function ContextAwareRunQueryButton({ queries, rootDatasourceUid }: Props) {
  const location = useLocation();
  
  // Detect if we're in dashboard panel edit mode
  const searchParams = locationService.getSearchObject();
  const isDashboardPanelEdit = Boolean(searchParams.editPanel);
  const isDashboardContext = location.pathname.includes('/d/') || location.pathname.includes('/dashboard/');

  if (isDashboardPanelEdit && isDashboardContext) {
    return <DashboardRunQueryButton queries={queries} rootDatasourceUid={rootDatasourceUid} />;
  }

  return <ExploreRunQueryButton queries={queries} rootDatasourceUid={rootDatasourceUid} />;
}
