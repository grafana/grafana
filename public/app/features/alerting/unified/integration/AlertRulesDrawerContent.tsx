import { isEmpty } from 'lodash';
import React from 'react';
import { useAsync } from 'react-use';

import { PanelModel } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardRoutes, useDispatch } from 'app/types';

import { RulesTable } from '../components/rules/RulesTable';
import { useCombinedRuleNamespaces } from '../hooks/useCombinedRuleNamespaces';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import { Annotation } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import LegacyAlertsWarning from './LegacyAlertsWarning';

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

  const panelsWithLegacyAlerts = dashboardData?.dashboard.panels?.filter((panel: PanelModel) => {
    return 'alert' in panel;
  });

  const hasLegacyAlerts = !isEmpty(panelsWithLegacyAlerts);

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
          {hasLegacyAlerts && <LegacyAlertsWarning dashboardUid={dashboardUid} panels={panelsWithLegacyAlerts} />}
          <RulesTable rules={rules} showNextEvaluationColumn={false} showGroupColumn={false} />
        </>
      )}
    </>
  );
}
