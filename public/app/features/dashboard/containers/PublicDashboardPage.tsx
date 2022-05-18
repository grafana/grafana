import React from 'react';

import { GrafanaRouteComponentProps } from '../../../core/navigation/types';

import DashboardPage, { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './DashboardPage';

export type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>;

/**
 * Wrap DashboardPage component and pass props relevant to public dashboards
 */
const PublicDashboardPage = (props: Props) => {
  return <DashboardPage isPublic {...props} />;
};

export default PublicDashboardPage;
