import { urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getUrlSyncManager, sceneGraph, SceneObject, SceneObjectUrlValues, SceneTimeRange } from '@grafana/scenes';

import { getDatasourceSrv } from '../plugins/datasource_srv';

import { DataTrail } from './DataTrail';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricScene } from './MetricScene';
import { getTrailStore } from './TrailStore/TrailStore';
import { TRAILS_ROUTE, VAR_DATASOURCE } from './shared';

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

export function getDatasourceForNewTrail(): string | undefined {
  const mostRecentTrail = getTrailStore().recent[0];
  const initialDS = mostRecentTrail?.resolve().state.$variables?.getByName(VAR_DATASOURCE)?.getValue();
  let initialDSValue = undefined;
  if (typeof initialDS === 'string') {
    initialDSValue = initialDS;
  } else {
    const promDatasources = getDatasourceSrv().getList({ type: 'prometheus' });
    if (config.defaultDatasource && promDatasources.find((mds) => mds.uid === config.defaultDatasource)) {
      initialDSValue = config.defaultDatasource;
    }
  }
  return initialDSValue;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}
