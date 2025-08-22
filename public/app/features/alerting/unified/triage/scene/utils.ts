import { uniqueId } from 'lodash';

import { SceneDataQuery, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

export const DS_UID = 'deeqciobdjj0gf';
export const METRIC_NAME = 'GRAFANA_ALERTS';

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
    queries: [query],
    datasource: datasourceRef,
    key: uniqueId('triage-request-'),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
  });
}
