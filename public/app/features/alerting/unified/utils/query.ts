import { produce } from 'immer';

import { DataSourceInstanceSettings } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { DataQuery } from '@grafana/schema';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isCloudRulesSource, isSupportedExternalRulesSourceType } from './datasource';
import { rulerRuleType } from './rules';
import { safeParsePrometheusDuration } from './time';

export function alertRuleToQueries(combinedRule: CombinedRule | undefined | null): AlertQuery[] {
  if (!combinedRule) {
    return [];
  }
  const { namespace, rulerRule } = combinedRule;
  const { rulesSource } = namespace;

  if (rulerRuleType.grafana.rule(rulerRule)) {
    const query = rulerRule.grafana_alert.data;
    return widenRelativeTimeRanges(query, rulerRule.for ?? '', combinedRule.group.interval);
  }

  if (isCloudRulesSource(rulesSource)) {
    const model = cloudAlertRuleToModel(rulesSource, combinedRule);

    return [dataQueryToAlertQuery(model, rulesSource.uid)];
  }

  return [];
}

/**
 * This function will figure out how large the time range for visualizing the alert rule detail view should be
 * We try to show as much data as is relevant for triaging / root cause analysis
 *
 * The function for it is;
 *
 *  Math.max(3 * pending period, query range + (2 * pending period))
 *
 * We can safely ignore the evaluation interval because the pending period is guaranteed to be largen than or equal that
 */
export function widenRelativeTimeRanges(queries: AlertQuery[], pendingPeriod: string, groupInterval?: string) {
  // if pending period is zero that means inherit from group interval, if that is empty then assume 1m
  const pendingPeriodDurationMillis =
    safeParsePrometheusDuration(pendingPeriod) ?? safeParsePrometheusDuration(groupInterval ?? '1m');
  const pendingPeriodDuration = Math.floor(pendingPeriodDurationMillis / 1000);

  return queries.map((query) =>
    produce(query, (draft) => {
      const fromQueryRange = draft.relativeTimeRange?.from ?? 0;

      // use whichever has the largest time range
      const from = Math.max(pendingPeriodDuration * 3, fromQueryRange + pendingPeriodDuration * 2);

      draft.relativeTimeRange = {
        from,
        to: 0,
      };
    })
  );
}

export function dataQueryToAlertQuery(dataQuery: DataQuery, dataSourceUid: string): AlertQuery {
  return {
    refId: dataQuery.refId,
    datasourceUid: dataSourceUid,
    queryType: '',
    model: dataQuery,
    relativeTimeRange: {
      from: 360,
      to: 0,
    },
  };
}

function cloudAlertRuleToModel(dsSettings: DataSourceInstanceSettings, rule: CombinedRule): DataQuery {
  if (!isSupportedExternalRulesSourceType(dsSettings.type)) {
    throw new Error(`Query for datasource type ${dsSettings.type} is currently not supported by cloud alert rules.`);
  }

  const query: LokiQuery | PromQuery = {
    refId: 'A',
    expr: rule.query,
  };

  return query;
}
