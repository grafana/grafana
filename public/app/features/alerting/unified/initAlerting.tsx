import { Suspense, lazy } from 'react';

import { config } from '@grafana/runtime';

import { addCustomRightAction } from '../../dashboard/components/DashNav/DashNav';

import { getGlobalRuleAbility } from './hooks/abilities/rules/ruleAbilities';
import { RuleAction } from './hooks/abilities/types';

const AlertRulesToolbarButton = lazy(
  () => import(/* webpackChunkName: "alert-rules-toolbar-button" */ './integration/AlertRulesToolbarButton')
);

export function initAlerting() {
  const alertingEnabled = config.unifiedAlertingEnabled;

  if (getGlobalRuleAbility(RuleAction.View).granted) {
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
