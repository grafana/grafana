import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsyncFn, useInterval } from 'react-use';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Button, LinkButton, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';

import { CombinedRuleNamespace } from '../../../types/unified-alerting';

import { LogMessages } from './Analytics';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { INSTANCES_DISPLAY_LIMIT } from './components/rules/RuleDetails';
import { RuleListErrors } from './components/rules/RuleListErrors';
import { RuleListGroupView } from './components/rules/RuleListGroupView';
import { RuleListStateView } from './components/rules/RuleListStateView';
import { RuleStats } from './components/rules/RuleStats';
import RulesFilter from './components/rules/RulesFilter';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { useFilteredRules, useRulesFilter } from './hooks/useFilteredRules';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { getAllRulesSourceNames } from './utils/datasource';
import { createUrl } from './utils/url';

const VIEWS = {
  groups: RuleListGroupView,
  state: RuleListStateView,
};

// make sure we ask for 1 more so we show the "show x more" button
const LIMIT_ALERTS = INSTANCES_DISPLAY_LIMIT + 1;

const RuleList = withErrorBoundary(
  () => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    const location = useLocation();
    const [expandAll, setExpandAll] = useState(false);

    const onFilterCleared = useCallback(() => setExpandAll(false), []);

    const [queryParams] = useQueryParams();
    const { filterState, hasActiveFilters } = useRulesFilter();

    const { canCreateGrafanaRules, canCreateCloudRules, canReadProvisioning } = useRulesAccess();

    const view = VIEWS[queryParams['view'] as keyof typeof VIEWS]
      ? (queryParams['view'] as keyof typeof VIEWS)
      : 'groups';

    const ViewComponent = VIEWS[view];

    const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

    const loading = rulesDataSourceNames.some(
      (name) => promRuleRequests[name]?.loading || rulerRuleRequests[name]?.loading
    );

    const promRequests = Object.entries(promRuleRequests);
    const allPromLoaded = promRequests.every(
      ([_, state]) => state.dispatched && (state?.result !== undefined || state?.error !== undefined)
    );
    const allPromEmpty = promRequests.every(([_, state]) => state.dispatched && state?.result?.length === 0);

    const limitAlerts = hasActiveFilters ? undefined : LIMIT_ALERTS;
    const matchers = '';
    // Trigger data refresh only when the RULE_LIST_POLL_INTERVAL_MS elapsed since the previous load FINISHED
    const [_, fetchRules] = useAsyncFn(async () => {
      if (!loading) {
        await dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts, matchers }));
      }
    }, [loading, limitAlerts, matchers, dispatch]);

    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(() => {
      dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts, matchers }));
    }, [dispatch, limitAlerts, matchers]);
    useInterval(fetchRules, RULE_LIST_POLL_INTERVAL_MS);

    // Show splash only when we loaded all of the data sources and none of them has alerts
    const hasNoAlertRulesCreatedYet = allPromLoaded && allPromEmpty && promRequests.length > 0;

    const combinedNamespaces: CombinedRuleNamespace[] = useCombinedRuleNamespaces();
    const filteredNamespaces = useFilteredRules(combinedNamespaces, filterState);

    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper pageId="alert-list" isLoading={false}>
        <RuleListErrors />
        <RulesFilter onFilterCleared={onFilterCleared} />
        {!hasNoAlertRulesCreatedYet && (
          <>
            <div className={styles.break} />
            <div className={styles.buttonsContainer}>
              <div className={styles.statsContainer}>
                {view === 'groups' && hasActiveFilters && (
                  <Button
                    className={styles.expandAllButton}
                    icon={expandAll ? 'angle-double-up' : 'angle-double-down'}
                    variant="secondary"
                    onClick={() => setExpandAll(!expandAll)}
                  >
                    {expandAll ? 'Collapse all' : 'Expand all'}
                  </Button>
                )}
                <RuleStats namespaces={filteredNamespaces} />
              </div>
              <Stack direction="row" gap={0.5}>
                {canReadProvisioning && (
                  <LinkButton
                    href={createUrl('/api/v1/provisioning/alert-rules/export', {
                      download: 'true',
                      format: 'yaml',
                    })}
                    icon="download-alt"
                    target="_blank"
                    rel="noopener"
                  >
                    Export
                  </LinkButton>
                )}
                {(canCreateGrafanaRules || canCreateCloudRules) && (
                  <LinkButton
                    href={urlUtil.renderUrl('alerting/new', { returnTo: location.pathname + location.search })}
                    icon="plus"
                    onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
                  >
                    Create alert rule
                  </LinkButton>
                )}
              </Stack>
            </div>
          </>
        )}
        {hasNoAlertRulesCreatedYet && <NoRulesSplash />}
        {!hasNoAlertRulesCreatedYet && <ViewComponent expandAll={expandAll} namespaces={filteredNamespaces} />}
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

const getStyles = (theme: GrafanaTheme2) => ({
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
  buttonsContainer: css`
    margin-bottom: ${theme.spacing(2)};
    display: flex;
    justify-content: space-between;
  `,
  statsContainer: css`
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  expandAllButton: css`
    margin-right: ${theme.spacing(1)};
  `,
});

export default RuleList;
