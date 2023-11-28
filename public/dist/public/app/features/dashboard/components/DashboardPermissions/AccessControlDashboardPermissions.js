import React from 'react';
import { config } from '@grafana/runtime';
import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export const AccessControlDashboardPermissions = ({ dashboard, sectionNav }) => {
    const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);
    const pageNav = config.featureToggles.dockedMegaMenu ? sectionNav.node.parentItem : undefined;
    return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
        React.createElement(Permissions, { resource: 'dashboards', resourceId: dashboard.uid, canSetPermissions: canSetPermissions })));
};
//# sourceMappingURL=AccessControlDashboardPermissions.js.map