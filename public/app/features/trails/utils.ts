import { urlUtil } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  CustomVariable,
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
import { LOGS_METRIC, TRAILS_ROUTE, VAR_DATASOURCE_EXPR, VAR_OTEL_DEPLOYMENT_ENV, VAR_OTEL_RESOURCES } from './shared';

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
  timeZone?: string;
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

/**
 * Return a collection of labels and labels filters.
 * This data is used to build the join query to filter with otel resources
 *
 * @param scene
 * @returns
 */
export function getOtelFilters(scene: SceneObject): { labels: string; filters: string } {
  const otelResources = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, scene);
  // add deployment env to otel resource filters
  const otelDepEnv = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, scene);

  if (otelResources instanceof AdHocFiltersVariable && otelDepEnv instanceof CustomVariable) {
    // get the collection of adhoc filters
    const otelFilters = otelResources.state.filters;

    // get the value for deployment_environment
    let otelDepEnvValue = String(otelDepEnv.getValue());
    const isMulti = otelDepEnvValue.includes(',');
    let op = '=';
    let val = otelDepEnvValue;

    if (isMulti) {
      op = '=~';
      val = val.split(',').join('|');
    }

    // start with the deployment environment
    let allFilters = `deployment_environment${op}"${val}"`;
    let allLabels = 'deployment_environment';

    for (let i = 0; i < otelFilters?.length; i++) {
      const labelName = otelFilters[i].key;
      const op = otelFilters[i].operator;
      const labelValue = otelFilters[i].value;

      allFilters += `,${labelName}${op}"${labelValue}"`;
      allLabels += `,${labelName}`;
    }

    return { filters: allFilters, labels: allLabels };
  }

  return { labels: '', filters: '' };
}
