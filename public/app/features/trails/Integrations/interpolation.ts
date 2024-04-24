import { DataSourceInstanceSettings } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

export async function interpolateVariables(
  vizPanel: VizPanel,
  dsInstanceSettings: DataSourceInstanceSettings,
  queries: DataQuery[]
): Promise<PromQuery[]> {
  const ds = await getDataSourceSrv().get(dsInstanceSettings.uid);
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (!ds.interpolateVariablesInQueries || !queryRunner) {
    return queries.filter(isPromQuery);
  }

  const interpolated = ds.interpolateVariablesInQueries(
    queries,
    { __sceneObject: { value: vizPanel } },
    queryRunner.state.data?.request?.filters
  );

  return interpolated.filter(isPromQuery);
}

export function isPromQuery(model: DataQuery): model is PromQuery {
  return 'expr' in model;
}
