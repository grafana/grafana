import {
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isSupportedExternalRulesSourceType,
} from '@grafana/alerting/internal';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
// eslint-disable-next-line @grafana/no-get-data-source-srv -- Preserve the existing UID and datasource-name lookup semantics.
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { type CombinedRule } from 'app/types/unified-alerting';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { type LokiQuery } from '../../../loki-helpers/types';

import { rulerRuleType } from './rules';
import { isCloudRulesSource } from './rulesSource';

export function getInstantFromDataQuery(query: AlertQuery<AlertDataQuery>): boolean | undefined {
  const dataSourceUID = query.datasourceUid ?? query.model.datasource?.uid;
  if (!dataSourceUID) {
    return undefined;
  }

  // find the datasource type from the UID
  const type = getDataSourceSrv().getInstanceSettings(dataSourceUID)?.type;
  if (!type) {
    return undefined;
  }

  // if the datasource is not a supported prometheus flavor or loki, return "undefined"
  if (!isSupportedExternalRulesSourceType(type)) {
    return undefined;
  }

  const { model } = query;

  // if the datasource is prometheus or loki, instant is defined in the model, or defaults to true
  const isInstantForPrometheus = 'instant' in model && model.instant !== undefined ? model.instant : true;
  const isInstantForLoki = 'queryType' in model && model.queryType !== undefined ? model.queryType === 'instant' : true;

  const isPrometheusFlavoredDataSourceType = isSupportedExternalPrometheusFlavoredRulesSourceType(type);
  const isInstant = isPrometheusFlavoredDataSourceType ? isInstantForPrometheus : isInstantForLoki;
  return isInstant;
}

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

function dataQueryToAlertQuery(dataQuery: DataQuery, dataSourceUid: string): AlertQuery {
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
