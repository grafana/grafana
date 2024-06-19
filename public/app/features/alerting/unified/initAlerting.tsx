import React from 'react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

import { getRulesPermissions } from './utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

const AlertRulesToolbarButton = React.lazy(
  () => import(/* webpackChunkName: "alert-rules-toolbar-button" */ './integration/AlertRulesToolbarButton')
);

export function initAlerting() {
  const grafanaRulesPermissions = getRulesPermissions(GRAFANA_RULES_SOURCE_NAME);
  const alertingEnabled = config.unifiedAlertingEnabled || (config.featureToggles.alertingPreviewUpgrade ?? false);

  if (contextSrv.hasPermission(grafanaRulesPermissions.read)) {
    addCustomRightAction({
      show: () => alertingEnabled,
      component: ({ dashboard }) =>
        alertingEnabled ? (
          <React.Suspense fallback={null} key="alert-rules-button">
            {dashboard && <AlertRulesToolbarButton dashboardUid={dashboard.uid} />}
          </React.Suspense>
        ) : null,
      index: -2,
    });
  }
}
