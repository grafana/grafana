import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';

import { SettingsPageProps } from '../DashboardSettings/types';

export const AccessControlDashboardPermissions = ({ dashboard, sectionNav }: SettingsPageProps) => {
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);
  const pageNav = sectionNav.node.parentItem;

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      <Permissions resource={'dashboards'} resourceId={dashboard.uid} canSetPermissions={canSetPermissions} />
    </Page>
  );
};
