import { urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getUrlSyncManager, sceneGraph, SceneObject, SceneObjectUrlValues, SceneTimeRange } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricScene } from './MetricScene';
import { TRAILS_ROUTE } from './shared';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}

export function newMetricsTrail(): DataTrail {
  return new DataTrail({
    //initialDS: 'gdev-prometheus',
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

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}
