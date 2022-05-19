import React from 'react';

import { GrafanaRouteComponentProps } from '../../../core/navigation/types';

import DashboardPage, { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './DashboardPage';

export type Props = GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>;

const PublicDashboardPage = (props: Props) => {
  return <DashboardPage isPublic {...props} />;
};

export default PublicDashboardPage;
