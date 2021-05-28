import { DataQuery, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { AlertQuery, RulerAlertingRuleDTO } from 'app/types/unified-alerting-dto';
import { isGrafanaRulesSource } from './datasource';
import { isAlertingRulerRule, isGrafanaRulerRule } from './rules';

export function alertRuleToQueries(ruleWithLocation: RuleWithLocation | undefined | null): AlertQuery[] {
  if (!ruleWithLocation) {
    return [];
  }

  const { ruleSourceName, rule } = ruleWithLocation;

  if (isGrafanaRulesSource(ruleSourceName)) {
    if (isGrafanaRulerRule(rule)) {
      return rule.grafana_alert.data;
    }
  }

  if (isAlertingRulerRule(rule)) {
    const dsSettings = getDataSourceSrv().getInstanceSettings(ruleSourceName);

    if (!dsSettings) {
      // notify user about error.
      return [];
    }

    const model = cloudAlertRuleToModel(dsSettings, rule);

    return [
      {
        refId: model.refId,
        datasourceUid: dsSettings.uid,
        queryType: '',
        model,
      },
    ];
  }

  return [];
}

function cloudAlertRuleToModel(dsSettings: DataSourceInstanceSettings, rule: RulerAlertingRuleDTO): DataQuery {
  const refId = 'A';

  switch (dsSettings.type) {
    case 'prometheus': {
      const query: PromQuery = {
        refId,
        expr: rule.expr,
      };

      return query;
    }

    case 'loki': {
      const query: LokiQuery = {
        refId,
        expr: rule.expr,
      };

      return query;
    }

    default:
      throw new Error(`Query for datasource type ${dsSettings.type} is currently not supported by cloud alert rules.`);
  }
}
