import React from 'react';
import { useAsync } from 'react-use';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardRoutes, useDispatch } from 'app/types';

import { RulesTable } from '../components/rules/RulesTable';
import { useCombinedRuleNamespaces } from '../hooks/useCombinedRuleNamespaces';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import { Annotation } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface Props {
  dashboardUid: string;
}

export default function AlertRulesDrawerContent({ dashboardUid }: Props) {
  const dispatch = useDispatch();

  const dashboardStateManager = getDashboardScenePageStateManager();

  const { loading: loadingDashboardData, value: dashboardData } = useAsync(() => {
    return dashboardStateManager.fetchDashboard({
      uid: dashboardUid,
      route: DashboardRoutes.Normal,
    });
  }, [dashboardStateManager]);

  console.log(dashboardData);
  const hasLegacyAlerts = dashboardData?.dashboard.panels?.some((panel) => {
    return 'alert' in panel;
  });
  console.log('hasLegacyAlerts', hasLegacyAlerts);

  const { loading: loadingRulesData } = useAsync(async () => {
    await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const grafanaNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const rules = grafanaNamespaces
    .flatMap((ns) => ns.groups)
    .flatMap((g) => g.rules)
    .filter((rule) => rule.annotations[Annotation.dashboardUID] === dashboardUid);

  const loading = loadingRulesData || loadingDashboardData;

  return (
    <>
      {loading ? (
        <LoadingPlaceholder text="Loading alert rules" />
      ) : (
        <>
          {hasLegacyAlerts && <Alert severity="warning" title="Legacy alerts found in this dashboard" />}
          <RulesTable rules={rules} showNextEvaluationColumn={false} showGroupColumn={false} />
        </>
      )}
    </>
  );
}
