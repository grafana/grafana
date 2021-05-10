import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, CustomScrollbar, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { CombinedRule } from 'app/types/unified-alerting';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
}

export const PanelAlertTab: FC<Props> = ({ dashboard, panel }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
  useEffect(() => {
    const fetch = () => {
      dispatch(fetchPromRulesAction(GRAFANA_RULES_SOURCE_NAME));
      dispatch(fetchRulerRulesAction(GRAFANA_RULES_SOURCE_NAME));
    };
    fetch();
    const interval = setInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [dispatch]);

  const promRuleRequest =
    useUnifiedAlertingSelector((state) => state.promRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;
  const rulerRuleRequest =
    useUnifiedAlertingSelector((state) => state.rulerRules[GRAFANA_RULES_SOURCE_NAME]) ?? initialAsyncRequestState;

  const loading = promRuleRequest.loading || rulerRuleRequest.loading;
  const promError = promRuleRequest.error;
  const rulesError = promRuleRequest.error;

  const combinedNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);

  // filter out rules that are relevant to this panel
  const rules = useMemo(
    (): CombinedRule[] =>
      combinedNamespaces
        .flatMap((ns) => ns.groups)
        .flatMap((group) => group.rules)
        .filter(
          (rule) =>
            rule.annotations[Annotation.dashboardUID] === dashboard.uid &&
            rule.annotations[Annotation.panelID] === String(panel.editSourceId)
        ),
    [combinedNamespaces, dashboard.uid, panel.editSourceId]
  );

  const alert =
    promError || rulesError ? (
      <Alert title="Errors loading rules" severity="error">
        {promError && <div>Failed to load Grafana threshold rules state: {promError.message || 'Unknown error.'}</div>}
        {rulesError && (
          <div>Failed to load Grafana threshold rules config: {rulesError.message || 'Unknown error.'}</div>
        )}
      </Alert>
    ) : null;

  if (loading && !rules.length) {
    return (
      <div className={styles.innerWrapper}>
        {alert}
        <LoadingPlaceholder text="Loading rules..." />
      </div>
    );
  }

  if (rules.length) {
    return (
      <>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.innerWrapper}>
            {alert}
            <RulesTable rules={rules} />
            {dashboard.meta.canEdit && (
              <NewRuleFromPanelButton className={styles.buttonWithMargin} panel={panel} dashboard={dashboard} />
            )}
          </div>
        </CustomScrollbar>
      </>
    );
  }

  return (
    <div className={styles.noRulesWrapper}>
      {alert}
      <p>There are no alert rules linked to this panel.</p>
      {dashboard.meta.canEdit && <NewRuleFromPanelButton panel={panel} dashboard={dashboard} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonWithMargin: css`
    margin-top: ${theme.spacing(3)};
  `,
  innerWrapper: css`
    padding: ${theme.spacing(2)};
  `,
  noRulesWrapper: css`
    margin: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(3)};
  `,
});
