import { urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getUrlSyncManager, SceneObject } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailsApp } from './DataTrailsApp';
import { MetricScene } from './MetricScene';

export function getTrailFor(model: SceneObject): DataTrail {
  if (model instanceof DataTrail) {
    return model;
  }

  if (model.parent) {
    return getTrailFor(model.parent);
  }

  console.error('Unable to find data trail for', model);

  throw new Error('Unable to find trail');
}

export function getTrailsAppFor(model: SceneObject): DataTrailsApp {
  if (model instanceof DataTrailsApp) {
    return model;
  }

  if (model.parent) {
    return getTrailsAppFor(model.parent);
  }

  console.error('Unable to find data trails app for', model);

  throw new Error('Unable to find trails app');
}

export function newEmptyTrail(): DataTrail {
  return new DataTrail({
    filters: [{ key: 'job', operator: '=', value: 'grafana' }],
    embedded: false,
  });
}

export function getUrlForTrail(trail: DataTrail) {
  const params = getUrlSyncManager().getUrlState(trail);
  return urlUtil.renderUrl('/data-trails/trail', params);
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
