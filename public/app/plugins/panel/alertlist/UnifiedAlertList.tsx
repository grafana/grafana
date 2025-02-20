import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useEffectOnce, useToggle } from 'react-use';

import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import {
  Alert,
  BigValue,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  LoadingPlaceholder,
  ScrollContainer,
  useStyles2,
} from '@grafana/ui';
import { config } from 'app/core/config';
import alertDef from 'app/features/alerting/state/alertDef';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import { useCombinedRuleNamespaces } from 'app/features/alerting/unified/hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import {
  fetchAllPromAndRulerRulesAction,
  fetchPromAndRulerRulesAction,
} from 'app/features/alerting/unified/state/actions';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { GRAFANA_DATASOURCE_NAME, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from 'app/features/alerting/unified/utils/matchers';
import {
  isAsyncRequestMapSlicePartiallyDispatched,
  isAsyncRequestMapSlicePartiallyFulfilled,
  isAsyncRequestMapSlicePending,
} from 'app/features/alerting/unified/utils/redux';
import { flattenCombinedRules, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { ThunkDispatch, useDispatch } from 'app/types';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertingAction, useAlertingAbility } from '../../../features/alerting/unified/hooks/useAbilities';
import { getAlertingRule } from '../../../features/alerting/unified/utils/rules';
import { AlertingRule, CombinedRuleWithLocation } from '../../../types/unified-alerting';

import { GroupMode, SortOrder, StateFilter, UnifiedAlertListOptions, ViewMode } from './types';
import GroupedModeView from './unified-alerting/GroupedView';
import UngroupedModeView from './unified-alerting/UngroupedView';
import { filterAlerts } from './util';

function getStateList(state: StateFilter) {
  const reducer = (list: string[], [stateKey, value]: [string, boolean]) => {
    if (Boolean(value)) {
      return [...list, stateKey];
    } else {
      return list;
    }
  };
  return Object.entries(state).reduce(reducer, []);
}

const fetchPromAndRuler = ({
  dispatch,
  limitInstances,
  matcherList,
  dataSourceName,
  stateList,
}: {
  dispatch: ThunkDispatch;
  limitInstances: boolean;
  matcherList?: Matcher[] | undefined;
  dataSourceName?: string;
  stateList: string[];
}) => {
  if (dataSourceName) {
    dispatch(
      fetchPromAndRulerRulesAction({
        rulesSourceName: dataSourceName,
        limitAlerts: limitInstances ? INSTANCES_DISPLAY_LIMIT : undefined,
        matcher: matcherList,
        state: stateList,
      })
    );
  } else {
    dispatch(
      fetchAllPromAndRulerRulesAction(false, {
        limitAlerts: limitInstances ? INSTANCES_DISPLAY_LIMIT : undefined,
        matcher: matcherList,
        state: stateList,
      })
    );
  }
};

function UnifiedAlertList(props: PanelProps<UnifiedAlertListOptions>) {
  const dispatch = useDispatch();
  const [limitInstances, toggleLimit] = useToggle(true);
  const [, gmaViewAllowed] = useAlertingAbility(AlertingAction.ViewAlertRule);

  const { usePrometheusRulesByNamespaceQuery } = alertRuleApi;

  const promRulesRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRulesRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

  const somePromRulesDispatched = isAsyncRequestMapSlicePartiallyDispatched(promRulesRequests);

  const hideViewRuleLinkText = props.width < 320;

  // backwards compat for "Inactive" state filter
  useEffect(() => {
    if (props.options.stateFilter.inactive === true) {
      props.options.stateFilter.normal = true; // enable the normal filter
    }
    props.options.stateFilter.inactive = undefined; // now disable inactive
  }, [props.options.stateFilter]);

  let dashboard: DashboardModel | undefined = undefined;

  useEffectOnce(() => {
    dashboard = getDashboardSrv().getCurrent();
  });

  const stateList = useMemo(() => getStateList(props.options.stateFilter), [props.options.stateFilter]);
  const { options, replaceVariables } = props;
  const dataSourceName =
    options.datasource === GRAFANA_DATASOURCE_NAME ? GRAFANA_RULES_SOURCE_NAME : options.datasource;
  const parsedOptions: UnifiedAlertListOptions = {
    ...props.options,
    alertName: replaceVariables(options.alertName),
    alertInstanceLabelFilter: replaceVariables(options.alertInstanceLabelFilter),
  };

  const matcherList = useMemo(
    () => parsePromQLStyleMatcherLooseSafe(parsedOptions.alertInstanceLabelFilter),
    [parsedOptions.alertInstanceLabelFilter]
  );

  // If the datasource is not defined we should NOT skip the query
  // Undefined dataSourceName means that there is no datasource filter applied and we should fetch all the rules
  const shouldFetchGrafanaRules = (!dataSourceName || dataSourceName === GRAFANA_RULES_SOURCE_NAME) && gmaViewAllowed;

  //For grafana managed rules, get the result using RTK Query to avoid the need of using the redux store
  //See https://github.com/grafana/grafana/pull/70482
  const {
    currentData: grafanaPromRules = [],
    isLoading: grafanaRulesLoading,
    refetch: refetchGrafanaPromRules,
  } = usePrometheusRulesByNamespaceQuery(
    {
      limitAlerts: limitInstances ? INSTANCES_DISPLAY_LIMIT : undefined,
      matcher: matcherList,
      state: stateList,
    },
    { skip: !shouldFetchGrafanaRules }
  );

  useEffect(() => {
    //we need promRules and rulerRules for getting the uid when creating the alert link in panel in case of being a rulerRule.
    if (!promRulesRequests.loading) {
      fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList });
    }
    const sub = dashboard?.events.subscribe(TimeRangeUpdatedEvent, () => {
      if (shouldFetchGrafanaRules) {
        refetchGrafanaPromRules();
      }

      if (!dataSourceName || dataSourceName !== GRAFANA_RULES_SOURCE_NAME) {
        fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList });
      }
    });
    return () => {
      sub?.unsubscribe();
    };
  }, [
    dispatch,
    dashboard,
    matcherList,
    stateList,
    limitInstances,
    dataSourceName,
    refetchGrafanaPromRules,
    shouldFetchGrafanaRules,
    promRulesRequests.loading,
  ]);

  const handleInstancesLimit = (limit: boolean) => {
    if (limit) {
      fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList });
      toggleLimit(true);
    } else {
      fetchPromAndRuler({ dispatch, limitInstances: false, matcherList, dataSourceName, stateList });
      toggleLimit(false);
    }
  };

  const combinedRules = useCombinedRuleNamespaces(undefined, grafanaPromRules);

  const someRulerRulesDispatched = isAsyncRequestMapSlicePartiallyDispatched(rulerRulesRequests);
  const haveResults = isAsyncRequestMapSlicePartiallyFulfilled(promRulesRequests);

  const dispatched = somePromRulesDispatched || someRulerRulesDispatched;
  const loading = isAsyncRequestMapSlicePending(promRulesRequests);

  const styles = useStyles2(getStyles);

  const flattenedCombinedRules = flattenCombinedRules(combinedRules);
  const order = props.options.sortOrder;

  const rules = useMemo(
    () => filterRules(props, sortRules(order, flattenedCombinedRules)),
    [flattenedCombinedRules, order, props]
  );

  const noAlertsMessage = rules.length === 0 ? 'No alerts matching filters' : undefined;

  const renderLoading = grafanaRulesLoading || (dispatched && loading && !haveResults);

  const havePreviousResults = Object.values(promRulesRequests).some((state) => state.result);

  return (
    <ScrollContainer minHeight="100%">
      {havePreviousResults && noAlertsMessage && <div className={styles.noAlertsMessage}>{noAlertsMessage}</div>}
      {havePreviousResults && (
        <section>
          {props.options.viewMode === ViewMode.Stat && (
            <BigValue
              width={props.width}
              height={props.height}
              graphMode={BigValueGraphMode.None}
              textMode={BigValueTextMode.Auto}
              justifyMode={BigValueJustifyMode.Auto}
              theme={config.theme2}
              value={{ text: `${rules.length}`, numeric: rules.length }}
            />
          )}
          {props.options.viewMode === ViewMode.List && props.options.groupMode === GroupMode.Custom && (
            <GroupedModeView rules={rules} options={parsedOptions} />
          )}
          {props.options.viewMode === ViewMode.List && props.options.groupMode === GroupMode.Default && (
            <UngroupedModeView
              rules={rules}
              options={parsedOptions}
              handleInstancesLimit={handleInstancesLimit}
              limitInstances={limitInstances}
              hideViewRuleLinkText={hideViewRuleLinkText}
            />
          )}
        </section>
      )}
      {/* loading moved here to avoid twitching  */}
      {renderLoading && <LoadingPlaceholder text="Loading..." />}
    </ScrollContainer>
  );
}

function sortRules(sortOrder: SortOrder, rules: CombinedRuleWithLocation[]) {
  if (sortOrder === SortOrder.Importance) {
    // @ts-ignore
    return sortBy(rules, (rule) => alertDef.alertStateSortScore[rule.state]);
  } else if (sortOrder === SortOrder.TimeAsc) {
    return sortBy(rules, (rule) => {
      //at this point rules are all AlertingRule, this check is only needed for Typescript checks
      const alertingRule: AlertingRule | undefined = getAlertingRule(rule) ?? undefined;
      return getFirstActiveAt(alertingRule) || new Date();
    });
  } else if (sortOrder === SortOrder.TimeDesc) {
    return sortBy(rules, (rule) => {
      //at this point rules are all AlertingRule, this check is only needed for Typescript checks
      const alertingRule: AlertingRule | undefined = getAlertingRule(rule) ?? undefined;
      return getFirstActiveAt(alertingRule) || new Date();
    }).reverse();
  }
  const result = sortBy(rules, (rule) => rule.name.toLowerCase());
  if (sortOrder === SortOrder.AlphaDesc) {
    result.reverse();
  }

  return result;
}

function filterRules(props: PanelProps<UnifiedAlertListOptions>, rules: CombinedRuleWithLocation[]) {
  const { options, replaceVariables } = props;

  let filteredRules = [...rules];
  if (options.dashboardAlerts) {
    const dashboardUid = getDashboardSrv().getCurrent()?.uid;
    filteredRules = filteredRules.filter(({ annotations = {} }) =>
      Object.entries(annotations).some(([key, value]) => key === Annotation.dashboardUID && value === dashboardUid)
    );
  }
  if (options.alertName) {
    const replacedName = replaceVariables(options.alertName);
    filteredRules = filteredRules.filter(({ name }) =>
      name.toLocaleLowerCase().includes(replacedName.toLocaleLowerCase())
    );
  }

  filteredRules = filteredRules.filter((rule) => {
    const alertingRule = getAlertingRule(rule);
    if (!alertingRule) {
      return false;
    }
    return (
      (options.stateFilter.firing && alertingRule.state === PromAlertingRuleState.Firing) ||
      (options.stateFilter.pending && alertingRule.state === PromAlertingRuleState.Pending) ||
      (options.stateFilter.normal && alertingRule.state === PromAlertingRuleState.Inactive)
    );
  });

  if (options.folder) {
    filteredRules = filteredRules.filter((rule) => {
      return rule.namespaceName === options.folder.title;
    });
  }
  if (options.datasource) {
    const isGrafanaDS = options.datasource === GRAFANA_DATASOURCE_NAME;

    filteredRules = filteredRules.filter(
      isGrafanaDS
        ? ({ dataSourceName }) => dataSourceName === GRAFANA_RULES_SOURCE_NAME
        : ({ dataSourceName }) => dataSourceName === options.datasource
    );
  }

  // Remove rules having 0 instances unless explicitly configured
  // AlertInstances filters instances and we need to prevent situation
  // when we display a rule with 0 instances
  filteredRules = filteredRules.reduce<CombinedRuleWithLocation[]>((rules, rule) => {
    const alertingRule = getAlertingRule(rule);
    const filteredAlerts = alertingRule
      ? filterAlerts(
          {
            stateFilter: options.stateFilter,
            alertInstanceLabelFilter: replaceVariables(options.alertInstanceLabelFilter),
          },
          alertingRule.alerts ?? []
        )
      : [];
    if (
      filteredAlerts.length ||
      (alertingRule?.state === PromAlertingRuleState.Inactive &&
        options.showInactiveAlerts &&
        !options.alertInstanceLabelFilter.length)
    ) {
      // We intentionally don't set alerts to filteredAlerts
      // because later we couldn't display that some alerts are hidden (ref AlertInstances filtering)
      rules.push(rule);
    }
    return rules;
  }, []);

  return filteredRules;
}

export const getStyles = (theme: GrafanaTheme2) => ({
  cardContainer: css({
    padding: theme.spacing(0.5, 0, 0.25, 0),
    lineHeight: theme.typography.body.lineHeight,
    marginBottom: 0,
  }),
  alertRuleList: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    listStyleType: 'none',
  }),
  alertRuleItem: css({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    background: theme.colors.background.secondary,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(0.5),

    gap: theme.spacing(2),
  }),
  alertName: css({
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.fontWeightBold,

    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  alertNameWrapper: css({
    display: 'flex',
    flex: 1,
    flexWrap: 'nowrap',
    flexDirection: 'column',

    minWidth: '100px',
  }),
  alertLabels: css({
    '> *': {
      marginRight: theme.spacing(0.5),
    },
  }),
  alertDuration: css({
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  alertRuleItemText: css({
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
    margin: 0,
  }),
  alertRuleItemTime: css({
    color: theme.colors.text.secondary,
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
  }),
  alertRuleItemInfo: css({
    fontWeight: 'normal',
    flexGrow: 2,
    display: 'flex',
    alignItems: 'flex-end',
  }),
  noAlertsMessage: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  }),
  alertIcon: css({
    marginRight: theme.spacing(0.5),
  }),
  instanceDetails: css({
    minWidth: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  customGroupDetails: css({
    marginBottom: theme.spacing(0.5),
  }),
  link: css({
    wordBreak: 'break-all',
    color: theme.colors.primary.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  hidden: css({
    display: 'none',
  }),
});

export function UnifiedAlertListPanel(props: PanelProps<UnifiedAlertListOptions>) {
  const [, gmaReadAllowed] = useAlertingAbility(AlertingAction.ViewAlertRule);
  const [, externalReadAllowed] = useAlertingAbility(AlertingAction.ViewExternalAlertRule);

  if (!gmaReadAllowed && !externalReadAllowed) {
    return (
      <Alert title="Permission required">Sorry, you do not have the required permissions to read alert rules</Alert>
    );
  }

  return <UnifiedAlertList {...props} />;
}
