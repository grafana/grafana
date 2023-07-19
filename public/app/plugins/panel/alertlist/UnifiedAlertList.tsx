import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useEffectOnce, useToggle } from 'react-use';

import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import {
  Alert,
  BigValue,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  CustomScrollbar,
  LoadingPlaceholder,
  useStyles2,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import alertDef from 'app/features/alerting/state/alertDef';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import { useCombinedRuleNamespaces } from 'app/features/alerting/unified/hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import {
  fetchAllPromAndRulerRulesAction,
  fetchPromAndRulerRulesAction,
} from 'app/features/alerting/unified/state/actions';
import { parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { GRAFANA_DATASOURCE_NAME, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import {
  isAsyncRequestMapSlicePartiallyDispatched,
  isAsyncRequestMapSlicePartiallyFulfilled,
  isAsyncRequestMapSlicePending,
} from 'app/features/alerting/unified/utils/redux';
import { flattenCombinedRules, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction, ThunkDispatch, useDispatch } from 'app/types';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

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

export function UnifiedAlertList(props: PanelProps<UnifiedAlertListOptions>) {
  const dispatch = useDispatch();
  const [limitInstances, toggleLimit] = useToggle(true);

  const { usePrometheusRulesByNamespaceQuery } = alertRuleApi;

  const promRulesRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRulesRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

  const somePromRulesDispatched = isAsyncRequestMapSlicePartiallyDispatched(promRulesRequests);

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
    () => parseMatchers(parsedOptions.alertInstanceLabelFilter),
    [parsedOptions.alertInstanceLabelFilter]
  );

  useEffect(() => {
    //we need promRules and rulerRules for getting the uid when creating the alert link in panel in case of being a rulerRule.
    if (!promRulesRequests.loading) {
      fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList });
    }
    const sub = dashboard?.events.subscribe(TimeRangeUpdatedEvent, () =>
      fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList })
    );
    return () => {
      sub?.unsubscribe();
    };
  }, [dispatch, dashboard, matcherList, stateList, limitInstances, dataSourceName, promRulesRequests.loading]);

  const handleInstancesLimit = (limit: boolean) => {
    if (limit) {
      fetchPromAndRuler({ dispatch, limitInstances, matcherList, dataSourceName, stateList });
      toggleLimit(true);
    } else {
      fetchPromAndRuler({ dispatch, limitInstances: false, matcherList, dataSourceName, stateList });
      toggleLimit(false);
    }
  };

  //For grafana managed rules, get the result using RTK Query to avoid the need of using the redux store
  //See https://github.com/grafana/grafana/pull/70482
  const { currentData: promRules = [], isLoading: grafanaRulesLoading } = usePrometheusRulesByNamespaceQuery(
    {
      limitAlerts: limitInstances ? INSTANCES_DISPLAY_LIMIT : undefined,
      matcher: matcherList,
      state: stateList,
    },
    { skip: dataSourceName !== GRAFANA_RULES_SOURCE_NAME }
  );

  const combinedRules = useCombinedRuleNamespaces(undefined, promRules);

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

  if (
    !contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) &&
    !contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalRead)
  ) {
    return (
      <Alert title="Permission required">Sorry, you do not have the required permissions to read alert rules</Alert>
    );
  }

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      <div className={styles.container}>
        {(grafanaRulesLoading || (dispatched && loading && !haveResults)) && <LoadingPlaceholder text="Loading..." />}
        {noAlertsMessage && <div className={styles.noAlertsMessage}>{noAlertsMessage}</div>}
        <section>
          {props.options.viewMode === ViewMode.Stat && haveResults && (
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
          {props.options.viewMode === ViewMode.List && props.options.groupMode === GroupMode.Custom && haveResults && (
            <GroupedModeView rules={rules} options={parsedOptions} />
          )}
          {props.options.viewMode === ViewMode.List && props.options.groupMode === GroupMode.Default && haveResults && (
            <UngroupedModeView
              rules={rules}
              options={parsedOptions}
              handleInstancesLimit={handleInstancesLimit}
              limitInstances={limitInstances}
            />
          )}
        </section>
      </div>
    </CustomScrollbar>
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

  // Remove rules having 0 instances
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
    if (filteredAlerts.length) {
      // We intentionally don't set alerts to filteredAlerts
      // because later we couldn't display that some alerts are hidden (ref AlertInstances filtering)
      rules.push(rule);
    }
    return rules;
  }, []);

  return filteredRules;
}

export const getStyles = (theme: GrafanaTheme2) => ({
  cardContainer: css`
    padding: ${theme.spacing(0.5)} 0 ${theme.spacing(0.25)} 0;
    line-height: ${theme.typography.body.lineHeight};
    margin-bottom: 0px;
  `,
  container: css`
    overflow-y: auto;
    height: 100%;
  `,
  alertRuleList: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    list-style-type: none;
  `,
  alertRuleItem: css`
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border-radius: ${theme.shape.borderRadius()};
    margin-bottom: ${theme.spacing(0.5)};

    gap: ${theme.spacing(2)};
  `,
  alertName: css`
    font-size: ${theme.typography.h6.fontSize};
    font-weight: ${theme.typography.fontWeightBold};

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  alertNameWrapper: css`
    display: flex;
    flex: 1;
    flex-wrap: nowrap;
    flex-direction: column;

    min-width: 100px;
  `,
  alertLabels: css`
    > * {
      margin-right: ${theme.spacing(0.5)};
    }
  `,
  alertDuration: css`
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  alertRuleItemText: css`
    font-weight: ${theme.typography.fontWeightBold};
    font-size: ${theme.typography.bodySmall.fontSize};
    margin: 0;
  `,
  alertRuleItemTime: css`
    color: ${theme.colors.text.secondary};
    font-weight: normal;
    white-space: nowrap;
  `,
  alertRuleItemInfo: css`
    font-weight: normal;
    flex-grow: 2;
    display: flex;
    align-items: flex-end;
  `,
  noAlertsMessage: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  `,
  alertIcon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
  instanceDetails: css`
    min-width: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  customGroupDetails: css`
    margin-bottom: ${theme.spacing(0.5)};
  `,
  link: css`
    word-break: break-all;
    color: ${theme.colors.primary.text};
  `,
});
