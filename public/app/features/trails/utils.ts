import { urlUtil } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  getUrlSyncManager,
  sceneGraph,
  SceneObject,
  SceneObjectState,
  SceneObjectUrlValues,
  SceneTimeRange,
} from '@grafana/scenes';

import { getDatasourceSrv } from '../plugins/datasource_srv';

import { DataTrail } from './DataTrail';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricScene } from './MetricScene';
import { getTrailStore } from './TrailStore/TrailStore';
import { LOGS_METRIC, TRAILS_ROUTE, VAR_DATASOURCE_EXPR } from './shared';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}

export function newMetricsTrail(initialDS?: string): DataTrail {
  return new DataTrail({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    //initialFilters: [{ key: 'job', operator: '=', value: 'grafana' }],
    embedded: false,
  });
}

export function getUrlForTrail(trail: DataTrail) {
  const params = getUrlSyncManager().getUrlState(trail);
  return getUrlForValues(params);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(TRAILS_ROUTE, values);
}

export function getMetricSceneFor(model: SceneObject): MetricScene {
  if (model instanceof MetricScene) {
    return model;
  }

  if (model.parent) {
    return getMetricSceneFor(model.parent);
  }

  console.error('Unable to find graph view for', model);

  throw new Error('Unable to find trail');
}

export function getDataSource(trail: DataTrail) {
  return sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
}

export function getDataSourceName(dataSourceUid: string) {
  return getDataSourceSrv().getInstanceSettings(dataSourceUid)?.name || dataSourceUid;
}

export function getMetricName(metric?: string) {
  if (!metric) {
    return 'Select metric';
  }

  if (metric === LOGS_METRIC) {
    return 'Logs';
  }

  return metric;
}

export function getDatasourceForNewTrail(): string | undefined {
  const prevTrail = getTrailStore().recent[0];
  if (prevTrail) {
    const prevDataSource = sceneGraph.interpolate(prevTrail.resolve(), VAR_DATASOURCE_EXPR);
    if (typeof prevDataSource === 'string' && prevDataSource.length > 0) {
      return prevDataSource;
    }
  }
  const promDatasources = getDatasourceSrv().getList({ type: 'prometheus' });
  if (promDatasources.length > 0) {
    return promDatasources.find((mds) => mds.uid === config.defaultDatasource)?.uid ?? promDatasources[0].uid;
  }
  return undefined;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export type SceneTimeRangeState = SceneObjectState & {
  from: string;
  to: string;
};
export function isSceneTimeRangeState(state: SceneObjectState): state is SceneTimeRangeState {
  const keys = Object.keys(state);
  return keys.includes('from') && keys.includes('to');
}

export function getFilters(scene: SceneObject) {
  const filters = sceneGraph.lookupVariable('filters', scene);
  if (filters instanceof AdHocFiltersVariable) {
    return filters.state.filters;
  }
  return null;
}
