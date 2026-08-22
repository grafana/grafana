import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

import AlertRulesToolbarButton from './integration/AlertRulesToolbarButton';

export function initAlerting() {
  const alertingEnabled = config.unifiedAlertingEnabled;

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    addCustomRightAction({
      show: () => alertingEnabled,
      component: ({ dashboard }) =>
        alertingEnabled && dashboard?.uid ? <AlertRulesToolbarButton dashboardUid={dashboard.uid} /> : null,
      index: -2,
    });
  }
}
