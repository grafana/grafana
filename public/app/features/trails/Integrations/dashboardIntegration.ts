import { PanelMenuItem, PanelModel } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { DashboardModel } from '../../dashboard/state';
import { DashboardScene } from '../../dashboard-scene/scene/DashboardScene';
import { MetricScene } from '../MetricScene';

import { DataTrailEmbedded, DataTrailEmbeddedState } from './DataTrailEmbedded';
import { SceneDrawerAsScene, launchSceneDrawerInGlobalModal } from './SceneDrawer';
import { QueryMetric, getQueryMetrics } from './getQueryMetrics';
import { interpolateVariables } from './interpolation';
import {
  createAdHocFilters,
  getPanelType,
  getQueryMetricLabel,
  getQueryRunner,
  getTimeRangeFromDashboard,
} from './utils';

export function addDataTrailPanelAction(
  dashboard: DashboardScene | DashboardModel,
  panel: VizPanel | PanelModel,
  items: PanelMenuItem[]
) {
  const panelType = getPanelType(panel);
  if (panelType !== 'timeseries') {
    return;
  }

  const queryRunner = getQueryRunner(panel);
  if (!queryRunner) {
    return;
  }

  const dsInstanceSettings = getDataSourceSrv().getInstanceSettings(queryRunner.state.datasource);

  if (!dsInstanceSettings || dsInstanceSettings?.meta.id !== 'prometheus') {
    return;
  }

  const interpolated = interpolateVariables(dashboard, dsInstanceSettings, queryRunner.state.queries);

  const queries = interpolated.map((q) => q.expr);

  const queryMetrics = getQueryMetrics(queries);

  const dataSourceRawRef = dsInstanceSettings?.rawRef;
  const subMenu: PanelMenuItem[] = queryMetrics.map((item) => {
    return {
      text: getQueryMetricLabel(item),
      onClick: createClickHandler(item, dashboard, dataSourceRawRef || dsInstanceSettings),
    };
  });

  if (subMenu.length > 0) {
    items.push({
      text: 'Explore metrics',
      iconClassName: 'code-branch',
      subMenu: getUnique(subMenu),
    });
  }
}

function getUnique<T extends { text: string }>(items: T[]) {
  const uniqueMenuTexts = new Set<string>();
  function isUnique({ text }: { text: string }) {
    const before = uniqueMenuTexts.size;
    uniqueMenuTexts.add(text);
    const after = uniqueMenuTexts.size;
    return after > before;
  }
  return items.filter(isUnique);
}

function getEmbeddedTrailsState(
  { metric, labelFilters, query }: QueryMetric,
  timeRange: SceneTimeRangeLike,
  dataSourceUid: string | undefined
) {
  const state: DataTrailEmbeddedState = {
    metric,
    filters: createAdHocFilters(labelFilters),
    dataSourceUid,
    timeRange,
  };

  return state;
}

function createCommonEmbeddedTrailStateProps(
  item: QueryMetric,
  dashboard: DashboardScene | DashboardModel,
  ds: DataSourceRef
) {
  const timeRange = getTimeRangeFromDashboard(dashboard);
  const trailState = getEmbeddedTrailsState(item, timeRange, ds.uid);
  const embeddedTrail: DataTrailEmbedded = new DataTrailEmbedded(trailState);

  embeddedTrail.trail.addActivationHandler(() => {
    if (embeddedTrail.trail.state.topScene instanceof MetricScene) {
      embeddedTrail.trail.state.topScene.setActionView('breakdown');
    }
  });

  const commonProps = {
    scene: embeddedTrail,
    title: 'Explore metrics',
  };

  return commonProps;
}

function createClickHandler(item: QueryMetric, dashboard: DashboardScene | DashboardModel, ds: DataSourceRef) {
  if (dashboard instanceof DashboardScene) {
    return () => {
      const commonProps = createCommonEmbeddedTrailStateProps(item, dashboard, ds);
      const drawerScene = new SceneDrawerAsScene({
        ...commonProps,
        onDismiss: () => dashboard.closeModal(),
      });
      dashboard.showModal(drawerScene);
    };
  } else {
    return () => launchSceneDrawerInGlobalModal(createCommonEmbeddedTrailStateProps(item, dashboard, ds));
  }
}
