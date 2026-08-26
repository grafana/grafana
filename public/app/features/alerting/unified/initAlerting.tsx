import { Suspense, lazy } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

const AlertRulesToolbarButton = lazy(
  () => import(/* webpackChunkName: "alert-rules-toolbar-button" */ './integration/AlertRulesToolbarButton')
);

export function initAlerting() {
  const alertingEnabled = config.unifiedAlertingEnabled;

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    addCustomRightAction({
      show: () => alertingEnabled,
      component: ({ dashboard }) =>
        alertingEnabled ? (
          <Suspense fallback={null} key="alert-rules-button">
            {dashboard && dashboard.uid && <AlertRulesToolbarButton dashboardUid={dashboard.uid} />}
          </Suspense>
        ) : null,
      index: -2,
    });
  }
}
