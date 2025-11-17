import { DataSourceInstanceSettings } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { DataQuery } from '@grafana/schema';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isCloudRulesSource, isSupportedExternalRulesSourceType } from './datasource';
import { rulerRuleType } from './rules';

export function alertRuleToQueries(combinedRule: CombinedRule | undefined | null): AlertQuery[] {
  if (!combinedRule) {
    return [];
  }
  const { namespace, rulerRule } = combinedRule;
  const { rulesSource } = namespace;

  if (rulerRuleType.grafana.rule(rulerRule)) {
    return rulerRule.grafana_alert.data;
  }

  if (isCloudRulesSource(rulesSource)) {
    const model = cloudAlertRuleToModel(rulesSource, combinedRule);

    return [dataQueryToAlertQuery(model, rulesSource.uid)];
  }

  return [];
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
