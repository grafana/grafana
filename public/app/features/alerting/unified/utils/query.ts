import { DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isCloudRulesSource, isGrafanaRulesSource } from './datasource';
import { isGrafanaRulerRule } from './rules';

export function alertRuleToQueries(combinedRule: CombinedRule | undefined | null): AlertQuery[] {
  if (!combinedRule) {
    return [];
  }
  const { namespace, rulerRule } = combinedRule;
  const { rulesSource } = namespace;

  if (isGrafanaRulesSource(rulesSource)) {
    if (isGrafanaRulerRule(rulerRule)) {
      return rulerRule.grafana_alert.data;
    }
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
  const refId = 'A';

  switch (dsSettings.type) {
    case 'prometheus': {
      const query: PromQuery = {
        refId,
        expr: rule.query,
      };

      return query;
    }

    case 'loki': {
      const query: LokiQuery = {
        refId,
        expr: rule.query,
      };

      return query;
    }

    default:
      throw new Error(`Query for datasource type ${dsSettings.type} is currently not supported by cloud alert rules.`);
  }
}
