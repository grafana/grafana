import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useEffectOnce } from 'react-use';

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
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { fetchAllPromRulesAction } from 'app/features/alerting/unified/state/actions';
import { labelsMatchMatchers, parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import {
  getAllRulesSourceNames,
  GRAFANA_DATASOURCE_NAME,
  GRAFANA_RULES_SOURCE_NAME,
} from 'app/features/alerting/unified/utils/datasource';
import { flattenRules, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { useDispatch, AccessControlAction } from 'app/types';
import { PromRuleWithLocation } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { GroupMode, SortOrder, UnifiedAlertListOptions, ViewMode } from './types';
import GroupedModeView from './unified-alerting/GroupedView';
import UngroupedModeView from './unified-alerting/UngroupedView';
import { filterAlerts } from './util';

export function UnifiedAlertList(props: PanelProps<UnifiedAlertListOptions>) {
  const dispatch = useDispatch();
  const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);

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

  useEffect(() => {
    dispatch(fetchAllPromRulesAction());
    const sub = dashboard?.events.subscribe(TimeRangeUpdatedEvent, () => dispatch(fetchAllPromRulesAction()));
    return () => {
      sub?.unsubscribe();
    };
  }, [dispatch, dashboard]);

  const promRulesRequests = useUnifiedAlertingSelector((state) => state.promRules);

  const dispatched = rulesDataSourceNames.some((name) => promRulesRequests[name]?.dispatched);
  const loading = rulesDataSourceNames.some((name) => promRulesRequests[name]?.loading);
  const haveResults = rulesDataSourceNames.some(
    (name) => promRulesRequests[name]?.result?.length && !promRulesRequests[name]?.error
  );

  const styles = useStyles2(getStyles);

  const rules = useMemo(
    () =>
      filterRules(
        props,
        sortRules(
          props.options.sortOrder,
          Object.values(promRulesRequests).flatMap(({ result = [] }) => flattenRules(result))
        )
      ),
    [props, promRulesRequests]
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
        {dispatched && loading && !haveResults && <LoadingPlaceholder text="Loading..." />}
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
            <GroupedModeView rules={rules} options={props.options} />
          )}
          {props.options.viewMode === ViewMode.List && props.options.groupMode === GroupMode.Default && haveResults && (
            <UngroupedModeView rules={rules} options={props.options} />
          )}
        </section>
      </div>
    </CustomScrollbar>
  );
}

function sortRules(sortOrder: SortOrder, rules: PromRuleWithLocation[]) {
  if (sortOrder === SortOrder.Importance) {
    // @ts-ignore
    return sortBy(rules, (rule) => alertDef.alertStateSortScore[rule.state]);
  } else if (sortOrder === SortOrder.TimeAsc) {
    return sortBy(rules, (rule) => getFirstActiveAt(rule.rule) || new Date());
  } else if (sortOrder === SortOrder.TimeDesc) {
    return sortBy(rules, (rule) => getFirstActiveAt(rule.rule) || new Date()).reverse();
  }
  const result = sortBy(rules, (rule) => rule.rule.name.toLowerCase());
  if (sortOrder === SortOrder.AlphaDesc) {
    result.reverse();
  }

  return result;
}

function filterRules(props: PanelProps<UnifiedAlertListOptions>, rules: PromRuleWithLocation[]) {
  const { options, replaceVariables } = props;

  let filteredRules = [...rules];
  if (options.dashboardAlerts) {
    const dashboardUid = getDashboardSrv().getCurrent()?.uid;
    filteredRules = filteredRules.filter(({ rule: { annotations = {} } }) =>
      Object.entries(annotations).some(([key, value]) => key === Annotation.dashboardUID && value === dashboardUid)
    );
  }
  if (options.alertName) {
    const replacedName = replaceVariables(options.alertName);
    filteredRules = filteredRules.filter(({ rule: { name } }) =>
      name.toLocaleLowerCase().includes(replacedName.toLocaleLowerCase())
    );
  }

  filteredRules = filteredRules.filter((rule) => {
    return (
      (options.stateFilter.firing && rule.rule.state === PromAlertingRuleState.Firing) ||
      (options.stateFilter.pending && rule.rule.state === PromAlertingRuleState.Pending) ||
      (options.stateFilter.normal && rule.rule.state === PromAlertingRuleState.Inactive)
    );
  });

  if (options.alertInstanceLabelFilter) {
    const replacedLabelFilter = replaceVariables(options.alertInstanceLabelFilter);
    const matchers = parseMatchers(replacedLabelFilter);
    // Reduce rules and instances to only those that match
    filteredRules = filteredRules.reduce<PromRuleWithLocation[]>((rules, rule) => {
      const filteredAlerts = (rule.rule.alerts ?? []).filter(({ labels }) => labelsMatchMatchers(labels, matchers));
      if (filteredAlerts.length) {
        rules.push({ ...rule, rule: { ...rule.rule, alerts: filteredAlerts } });
      }
      return rules;
    }, []);
  }

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
  filteredRules = filteredRules.reduce<PromRuleWithLocation[]>((rules, rule) => {
    const filteredAlerts = filterAlerts(options, rule.rule.alerts ?? []);
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
    border-radius: ${theme.shape.borderRadius(2)};
    margin-bottom: ${theme.spacing(0.5)};

    & > * {
      margin-right: ${theme.spacing(1)};
    }
  `,
  alertName: css`
    font-size: ${theme.typography.h6.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
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
});
