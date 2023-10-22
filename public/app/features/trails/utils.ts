import { urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getUrlSyncManager, SceneObject, SceneTimeRange } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricScene } from './MetricScene';
import { LOGS_METRIC } from './shared';

export function getTrailFor(model: SceneObject): DataTrail {
  return getParentOfType(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return getParentOfType(model, DataTrail).state.settings;
}

export function newMetricsTrail(): DataTrail {
  return new DataTrail({
    initialDS: 'gdev-prometheus',
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    initialFilters: [{ key: 'job', operator: '=', value: 'grafana' }],
    embedded: false,
  });
}

export function newLogsTrail(): DataTrail {
  return new DataTrail({
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    initialFilters: [{ key: 'job', operator: '=', value: 'grafana' }],
    metric: LOGS_METRIC,
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

type Newable<T> = { new (...args: never[]): T };

export function getParentOfType<T>(model: SceneObject, type: Newable<T>): T {
  if (model instanceof type) {
    return model;
  }

  if (model.parent) {
    return getParentOfType(model.parent, type);
  }

  console.error('Unable to parent of type', type);

  throw new Error('Unable to find parent of type ' + type.name);
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}
