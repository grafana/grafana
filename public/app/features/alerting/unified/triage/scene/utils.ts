import { uniqueId } from 'lodash';

import { SceneDataQuery, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

export const DS_UID = 'gdev-prometheus';
export const METRIC_NAME = 'GRAFANA_ALERTS';
export const DEFAULT_FIELDS = ['alertname', 'grafana_folder', 'grafana_rule_uid', 'alertstate'];

// @TODO figure out how we can grab the datasource ref from the Grafana config
export function getQueryRunner(expression: string, options?: Partial<SceneDataQuery>): SceneQueryRunner {
  const datasourceRef: DataSourceRef = {
    type: 'prometheus',
    uid: DS_UID,
  };

  const query: SceneDataQuery = {
    refId: 'A',
    expr: expression,
    instant: false,
    datasource: datasourceRef,
    ...options,
  };

  return new SceneQueryRunner({
    key: uniqueId('triage-request-'),
    queries: [query],
    datasource: datasourceRef,
  });
}

export const defaultTimeRange = {
  from: 'now-4h',
  to: 'now',
} as const;
