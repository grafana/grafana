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
  CustomScrollbar,
  LoadingPlaceholder,
  useStyles2,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import { useCombinedRuleNamespaces } from 'app/features/alerting/unified/hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import {
  fetchAllPromAndRulerRulesAction,
  fetchPromAndRulerRulesAction,
} from 'app/features/alerting/unified/state/actions';
import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { getOodleRulesSources, GRAFANA_DATASOURCE_NAME, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from 'app/features/alerting/unified/utils/matchers';
import {
  isAsyncRequestMapSlicePartiallyDispatched,
  isAsyncRequestMapSlicePartiallyFulfilled,
  isAsyncRequestMapSlicePending,
} from 'app/features/alerting/unified/utils/redux';
import { flattenCombinedRules, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { ThunkDispatch, useDispatch } from 'app/types';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertingAction, useAlertingAbility } from '../../../features/alerting/unified/hooks/useAbilities';
import { getAlertingRule } from '../../../features/alerting/unified/utils/rules';
import { AlertingRule, CombinedRuleWithLocation } from '../../../types/unified-alerting';

import { GroupMode, SortOrder, StateFilter, UnifiedAlertListOptions, ViewMode } from './types';
import GroupedModeView from './unified-alerting/GroupedView';
import UngroupedModeView from './unified-alerting/UngroupedView';

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
      }, getOodleRulesSources().map((ds) => ds.name))
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

  //For Grafana and Oodle managed rules, get the result using RTK Query to avoid the need of using the redux store
  //See https://github.com/grafana/grafana/pull/70482
  const oodleSources = getOodleRulesSources();
  const oodleSourcesToFetchFrom = useMemo(
    () => !dataSourceName
      ? oodleSources
      : oodleSources.filter((ds) => ds.name === dataSourceName),
    [dataSourceName, oodleSources]
  );
  const shouldFetchOodleRules = oodleSourcesToFetchFrom.length > 0;

  const {
    currentData: oodlePromRules = [],
    isLoading: oodleRulesLoading,
    refetch: refetchOodlePromRules,
  } = usePrometheusRulesByNamespaceQuery(
    {
      limitAlerts: limitInstances ? INSTANCES_DISPLAY_LIMIT : undefined,
      matcher: [{
        name: 'name',
        value: `.*${props.options.alertName}.*`,
        isRegex: true,
        isEqual: true
      }, ...matcherList],
      state: stateList,
      sourceUID: oodleSourcesToFetchFrom.map((ds) => ds.uid)[0],
    },
    { skip: oodleSourcesToFetchFrom.length === 0 }
  );

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
      if (shouldFetchOodleRules) {
        refetchOodlePromRules();
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
    shouldFetchOodleRules,
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

  const combinedRules = useCombinedRuleNamespaces(
    undefined,
    [...grafanaPromRules, ...oodlePromRules]
  );
  console.log({ combinedRules });

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

  const renderLoading = grafanaRulesLoading || oodleRulesLoading || (dispatched && loading && !haveResults);

  const havePreviousResults = Object.values(promRulesRequests).some((state) => state.result);

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      <div className={styles.container}>
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
      </div>
    </CustomScrollbar>
  );
}

function sortRules(sortOrder: SortOrder, rules: CombinedRuleWithLocation[]) {
  if (sortOrder === SortOrder.Importance) {
    // Enhanced importance sorting: Critical (Firing) first, then Warning (Pending), then Normal (Inactive)
    return sortBy(rules, (rule) => {
      const alertingRule = getAlertingRule(rule);
      if (!alertingRule) {
        return 999; // Put rules without alerting data at the end
      }

      // Priority order: Firing (Critical) = 1, Pending (Warning) = 2, Inactive (Normal) = 3
      switch (alertingRule.state) {
        case PromAlertingRuleState.Firing:
          return 1; // Highest priority - Critical alerts
        case PromAlertingRuleState.Pending:
          return 2; // Medium priority - Warning alerts
        case PromAlertingRuleState.Inactive:
          return 3; // Lowest priority - Normal/OK alerts
        default:
          return 999; // Unknown states at the end
      }
    });
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

  // Apply alertInstanceLabelFilter to filter rules based on their alert instances
  if (options.alertInstanceLabelFilter) {
    const replacedLabelFilter = replaceVariables(options.alertInstanceLabelFilter);
    if (replacedLabelFilter) {
      filteredRules = filteredRules.filter((rule) => {
        const alertingRule = getAlertingRule(rule);
        if (!alertingRule) {
          return false;
        }

        // Check if the rule itself, or any alert instance matches the label
        // filter.
        const labelDicts = [
          ...(alertingRule.labels ? [alertingRule.labels] : []),
          ...(alertingRule.alerts ? alertingRule.alerts.map((alert) => alert.labels) : [])
        ];
        if (labelDicts.length === 0) {
          return false;
        }

        return labelDicts.some((labelDict) => {
          try {
            const matchers = parsePromQLStyleMatcherLooseSafe(replacedLabelFilter);
            return labelsMatchMatchers(labelDict, matchers);
          } catch (error) {
            // Enhanced fallback for more matcher types
            return Object.entries(labelDict).some(([key, value]) => {
              // Handle exact match: key="value"
              if (replacedLabelFilter.includes(`${key}="${value}"`)) {
                return true;
              }

              // Handle negative exact match: key!="value"
              if (replacedLabelFilter.includes(`${key}!="${value}"`)) {
                return false; // This label value should NOT match
              }

              // Handle regex match: key=~"value"
              if (replacedLabelFilter.includes(`${key}=~"${value}"`)) {
                return true;
              }

              // Handle negative regex match: key!~"value"
              if (replacedLabelFilter.includes(`${key}!~"${value}"`)) {
                return false; // This label value should NOT match regex
              }

              return false;
            });
          }
        });
      });
    }
  }

  // // Remove rules having 0 instances
  // // AlertInstances filters instances and we need to prevent situation
  // // when we display a rule with 0 instances
  // filteredRules = filteredRules.reduce<CombinedRuleWithLocation[]>((rules, rule) => {
  //   const alertingRule = getAlertingRule(rule);
  //   const filteredAlerts = alertingRule
  //     ? filterAlerts(
  //         {
  //           stateFilter: options.stateFilter,
  //           alertInstanceLabelFilter: replaceVariables(options.alertInstanceLabelFilter),
  //         },
  //         alertingRule.alerts ?? []
  //       )
  //     : [];
  //   if (filteredAlerts.length) {
  //     // We intentionally don't set alerts to filteredAlerts
  //     // because later we couldn't display that some alerts are hidden (ref AlertInstances filtering)
  //     rules.push(rule);
  //   }
  //   return rules;
  // }, []);

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
    border-radius: ${theme.shape.radius.default};
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
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
  hidden: css`
    display: none;
  `,
  severityTag: css`
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(0.25)} ${theme.spacing(0.5)};
    border-radius: ${theme.shape.radius.default};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  `,
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
