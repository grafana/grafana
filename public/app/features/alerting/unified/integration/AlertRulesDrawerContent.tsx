import React from 'react';
import { useAsync } from 'react-use';

import { LoadingPlaceholder } from '@grafana/ui';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardRoutes, useDispatch } from 'app/types';

import { RulesTable } from '../components/rules/RulesTable';
import { useCombinedRuleNamespaces } from '../hooks/useCombinedRuleNamespaces';
import { fetchPromAndRulerRulesAction } from '../state/actions';
import { Annotation } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import LegacyAlertsDeprecationNotice from './LegacyAlertsDeprecationNotice';

interface Props {
  dashboardUid: string;
}

export default function AlertRulesDrawerContent({ dashboardUid }: Props) {
  const dispatch = useDispatch();
  const dashboardStateManager = getDashboardScenePageStateManager();

  const { value: dashboard, loading: loadingDashboardState } = useAsync(() => {
    return dashboardStateManager
      .fetchDashboard({
        uid: dashboardUid,
        route: DashboardRoutes.Normal,
      })
      .then((data) => (data ? data.dashboard : undefined));
  }, [dashboardStateManager]);

  const { loading: loadingAlertRules } = useAsync(async () => {
    await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const grafanaNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const rules = grafanaNamespaces
    .flatMap((ns) => ns.groups)
    .flatMap((g) => g.rules)
    .filter((rule) => rule.annotations[Annotation.dashboardUID] === dashboardUid);

  const loading = loadingDashboardState || loadingAlertRules;

  return (
    <>
      {loading ? (
        <LoadingPlaceholder text="Loading alert rules" />
      ) : (
        <>
          <LegacyAlertsDeprecationNotice dashboard={dashboard} />
          <RulesTable rules={rules} showNextEvaluationColumn={false} showGroupColumn={false} />
        </>
      )}
    </>
  );
}
