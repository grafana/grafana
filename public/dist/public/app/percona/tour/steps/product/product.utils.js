import React from 'react';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';
import SidebarStep from '../../components/SidebarStep';
import { Messages } from './product.messages';
export const getPMMDashboardsStep = (services) => {
    if (services.includes(ServiceType.mysql)) {
        return getStep('MySQL', 'mysql');
    }
    else if (services.includes(ServiceType.posgresql)) {
        return getStep('PostgreSQL', 'postgre');
    }
    else if (services.includes(ServiceType.mongodb)) {
        return getStep('MongoDB', 'mongo');
    }
    else if (services.includes(ServiceType.proxysql)) {
        return getStep('ProxySQL', 'proxysql');
    }
    else if (services.includes(ServiceType.haproxy)) {
        return getStep('HAProxy', 'haproxy');
    }
    return getStep('Operating System (OS)', 'system');
};
const getStep = (ariaLabel, navMenuId) => ({
    selector: '#navbar-menu-portal-container [role="dialog"]',
    content: (React.createElement(SidebarStep, { title: Messages.pmmDashboards.title },
        React.createElement("p", null, Messages.pmmDashboards.grafanaTechnology),
        React.createElement("p", null, Messages.pmmDashboards.observe),
        React.createElement("p", null, Messages.pmmDashboards.zoomIn))),
    navMenuId,
    highlightedSelectors: [`.dropdown > [aria-label="${ariaLabel}"]`, '#navbar-menu-portal-container [role="dialog"]'],
    resizeObservables: ['#navbar-menu-portal-container'],
    position: 'right',
});
//# sourceMappingURL=product.utils.js.map