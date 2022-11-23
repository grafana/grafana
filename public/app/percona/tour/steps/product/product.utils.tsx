import React from 'react';

import { TourStep } from 'app/percona/shared/core/reducers/tour';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';

import SidebarStep from '../../components/SidebarStep';

import { Messages } from './product.messages';

export const getPMMDashboardsStep = (services: ServiceType[]): TourStep => {
  if (services.includes(ServiceType.mysql)) {
    return getStep('MySQL', 'mysql');
  } else if (services.includes(ServiceType.posgresql)) {
    return getStep('PostgreSQL', 'postgre');
  } else if (services.includes(ServiceType.mongodb)) {
    return getStep('MongoDB', 'mongo');
  } else if (services.includes(ServiceType.proxysql)) {
    return getStep('ProxySQL', 'proxysql');
  } else if (services.includes(ServiceType.haproxy)) {
    return getStep('HAProxy', 'haproxy');
  }

  return getStep('Operating System (OS)', 'system');
};

const getStep = (ariaLabel: string, navMenuId: string): TourStep => ({
  selector: '#navbar-menu-portal-container [role="dialog"]',
  content: (
    <SidebarStep title={Messages.pmmDashboards.title}>
      <p>{Messages.pmmDashboards.grafanaTechnology}</p>
      <p>{Messages.pmmDashboards.observe}</p>
      <p>{Messages.pmmDashboards.zoomIn}</p>
    </SidebarStep>
  ),
  navMenuId,
  highlightedSelectors: [`.dropdown > [aria-label="${ariaLabel}"]`, '#navbar-menu-portal-container [role="dialog"]'],
  resizeObservables: ['#navbar-menu-portal-container'],
  position: 'right',
});
