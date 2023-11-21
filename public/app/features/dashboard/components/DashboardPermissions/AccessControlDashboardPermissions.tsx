import React from 'react';

import { config } from '@grafana/runtime';
import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { SettingsPageProps } from '../DashboardSettings/types';

export const AccessControlDashboardPermissions = ({ dashboard, sectionNav }: SettingsPageProps) => {
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);
  const pageNav = config.featureToggles.dockedMegaMenu ? sectionNav.node.parentItem : undefined;

  return (
    <Page navModel={sectionNav} pageNav={pageNav}>
      <Permissions resource={'dashboards'} resourceId={dashboard.uid} canSetPermissions={canSetPermissions} />
    </Page>
  );
};
