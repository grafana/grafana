import React from 'react';

import { config } from '@grafana/runtime';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

const AlertRulesToolbarButton = React.lazy(
  () => import(/* webpackChunkName: "alert-rules-toolbar-button" */ './integration/AlertRulesToolbarButton')
);

export function initAlerting() {
  addCustomRightAction({
    show: () => config.unifiedAlertingEnabled || (config.featureToggles.alertingPreviewUpgrade ?? false),
    component: ({ dashboard }) => (
      <React.Suspense fallback={null} key="alert-rules-button">
        {dashboard && <AlertRulesToolbarButton dashboardUid={dashboard.uid} />}
      </React.Suspense>
    ),
    index: -2,
  });
}
