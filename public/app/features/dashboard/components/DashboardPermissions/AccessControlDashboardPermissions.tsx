import React from 'react';

import { Permissions } from 'app/core/components/AccessControl';
import { Page } from 'app/core/components/PageNew/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { SettingsPageProps } from '../DashboardSettings/types';

export const AccessControlDashboardPermissions = ({ dashboard, sectionNav }: SettingsPageProps) => {
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return (
    <Page navModel={sectionNav}>
      <Permissions resource={'dashboards'} resourceId={dashboard.uid} canSetPermissions={canSetPermissions} />
    </Page>
  );
};
