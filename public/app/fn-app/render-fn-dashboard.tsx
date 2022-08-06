import React from 'react';

import DashboardPage from 'app/features/dashboard/containers/DashboardPage';
import { DashboardRoutes } from 'app/types';

import { FNDashboardProps } from './types';

export const RenderFNDashboard: React.Component<FNDashboardProps> = (data) => {
  console.log('renderFNDashboard with slug: ', data.slug);
  console.log('dashboard uid', data.uid);
  const props = {
    match: {
      params: {
        ...data,
      },
      isExact: true,
      path: '/d/:uid/:slug?',
      url: '',
    },
    // eslint-disable-next-line
    history: {} as any,
    // eslint-disable-next-line
    location: {} as any,
    queryParams: {},
    route: {
      routeName: DashboardRoutes.Normal,
      path: '/d/:uid/:slug?',
      pageClass: 'page-dashboard',
      component: DashboardPage,
    },
  };

  return <DashboardPage isFNDashboard {...props} />;
};
