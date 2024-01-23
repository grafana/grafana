import React from 'react';

import { config } from '@grafana/runtime';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

import { AlertRulesToolbarButton } from './integration/AlertRulesDrawer';

export function initAlerting() {
  addCustomRightAction({
    show: () => config.unifiedAlertingEnabled,
    component: ({ dashboard }) => dashboard && <AlertRulesToolbarButton dashboardUid={dashboard.uid} />,
    index: -2,
  });
}
