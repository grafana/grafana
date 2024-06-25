import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsyncFn, useInterval, useMeasure } from 'react-use';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Button, LinkButton, LoadingBar, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { CombinedRuleNamespace } from '../../../../../types/unified-alerting';
import { LogMessages, logInfo, trackRuleListNavigation } from '../../Analytics';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useFilteredRules, useRulesFilter } from '../../hooks/useFilteredRules';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchAllPromAndRulerRulesAction } from '../../state/actions';
import { RULE_LIST_POLL_INTERVAL_MS } from '../../utils/constants';
import { getAllRulesSourceNames, getRulesSourceUniqueKey, getApplicationFromRulesSource } from '../../utils/datasource';
import { makeFolderAlertsLink } from '../../utils/misc';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { NoRulesSplash } from '../rules/NoRulesCTA';
import { INSTANCES_DISPLAY_LIMIT } from '../rules/RuleDetails';
import { RuleListErrors } from '../rules/RuleListErrors';
import { RuleStats } from '../rules/RuleStats';
import RulesFilter from '../rules/RulesFilter';

import { EvaluationGroupWithRules } from './EvaluationGroupWithRules';
import Namespace from './Namespace';

// make sure we ask for 1 more so we show the "show x more" button
const LIMIT_ALERTS = INSTANCES_DISPLAY_LIMIT + 1;

const RuleList = withErrorBoundary(
  () => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    const [expandAll, setExpandAll] = useState(false);

    const onFilterCleared = useCallback(() => setExpandAll(false), []);

    const { filterState, hasActiveFilters } = useRulesFilter();

    const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

    const loading = rulesDataSourceNames.some(
      (name) => promRuleRequests[name]?.loading || rulerRuleRequests[name]?.loading
    );

    const promRequests = Object.entries(promRuleRequests);
    const rulerRequests = Object.entries(rulerRuleRequests);

    const allPromLoaded = promRequests.every(
      ([_, state]) => state.dispatched && (state?.result !== undefined || state?.error !== undefined)
    );
    const allRulerLoaded = rulerRequests.every(
      ([_, state]) => state.dispatched && (state?.result !== undefined || state?.error !== undefined)
    );

    const allPromEmpty = promRequests.every(([_, state]) => state.dispatched && state?.result?.length === 0);

    const allRulerEmpty = rulerRequests.every(([_, state]) => {
      const rulerRules = Object.entries(state?.result ?? {});
      const noRules = rulerRules.every(([_, result]) => result?.length === 0);
      return noRules && state.dispatched;
    });

    const limitAlerts = hasActiveFilters ? undefined : LIMIT_ALERTS;
    // Trigger data refresh only when the RULE_LIST_POLL_INTERVAL_MS elapsed since the previous load FINISHED
    const [_, fetchRules] = useAsyncFn(async () => {
      if (!loading) {
        await dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts }));
      }
    }, [loading, limitAlerts, dispatch]);

    useEffect(() => {
      trackRuleListNavigation().catch(() => {});
    }, []);

    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(() => {
      dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts }));
    }, [dispatch, limitAlerts]);
    useInterval(fetchRules, RULE_LIST_POLL_INTERVAL_MS);

    // Show splash only when we loaded all of the data sources and none of them has alerts
    const hasNoAlertRulesCreatedYet =
      allPromLoaded && allPromEmpty && promRequests.length > 0 && allRulerEmpty && allRulerLoaded;
    const hasAlertRulesCreated = !hasNoAlertRulesCreatedYet;

    const combinedNamespaces: CombinedRuleNamespace[] = useCombinedRuleNamespaces();
    const filteredNamespaces = useFilteredRules(combinedNamespaces, filterState);

    const sortedNamespaces = filteredNamespaces.sort((a: CombinedRuleNamespace, b: CombinedRuleNamespace) =>
      a.name.localeCompare(b.name)
    );

    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper navId="alert-list" isLoading={false} actions={hasAlertRulesCreated && <CreateAlertButton />}>
        <RuleListErrors />
        <RulesFilter onFilterCleared={onFilterCleared} />
        {hasAlertRulesCreated && (
          <>
            <div className={styles.break} />
            <div className={styles.buttonsContainer}>
              <div className={styles.statsContainer}>
                {hasActiveFilters && (
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
            </div>
          </>
        )}
        {hasNoAlertRulesCreatedYet && <NoRulesSplash />}
        {hasAlertRulesCreated && (
          <>
            <LoadingIndicator visible={loading} />
            <ul className={styles.rulesTree} role="tree" aria-label="List of alert rules">
              {sortedNamespaces.map((namespace) => {
                const { rulesSource, uid } = namespace;

                const application = getApplicationFromRulesSource(rulesSource);
                const href = application === 'grafana' && uid ? makeFolderAlertsLink(uid, namespace.name) : undefined;

                return (
                  <Namespace
                    key={getRulesSourceUniqueKey(rulesSource) + namespace.name}
                    href={href}
                    name={namespace.name}
                    application={application}
                  >
                    {namespace.groups
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((group) => (
                        <EvaluationGroupWithRules key={group.name} group={group} rulesSource={rulesSource} />
                      ))}
                  </Namespace>
                );
              })}
            </ul>
          </>
        )}
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

const LoadingIndicator = ({ visible = false }) => {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  return <div ref={measureRef}>{visible && <LoadingBar width={width} />}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  rulesTree: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  break: css({
    width: '100%',
    height: 0,
    marginBottom: theme.spacing(2),
    borderBottom: `solid 1px ${theme.colors.border.medium}`,
  }),
  buttonsContainer: css({
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
  }),
  statsContainer: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  expandAllButton: css({
    marginRight: theme.spacing(1),
  }),
});

export default RuleList;

export function CreateAlertButton() {
  const [createRuleSupported, createRuleAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);

  const location = useLocation();

  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;

  const canCreateGrafanaRules = createRuleSupported && createRuleAllowed;

  if (canCreateGrafanaRules || canCreateCloudRules) {
    return (
      <LinkButton
        href={urlUtil.renderUrl('alerting/new/alerting', { returnTo: location.pathname + location.search })}
        icon="plus"
        onClick={() => logInfo(LogMessages.alertRuleFromScratch)}
      >
        New alert rule
      </LinkButton>
    );
  }
  return null;
}
