import { isString } from 'lodash';

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
import { createAdHocFilters, getQueryMetricLabel, getQueryRunner, getTimeRangeFromDashboard } from './utils';

export function addDataTrailPanelAction(
  dashboard: DashboardScene | DashboardModel,
  panel: VizPanel | PanelModel,
  items: PanelMenuItem[]
) {
  const queryRunner = getQueryRunner(panel);
  if (!queryRunner) {
    return;
  }

  const ds = getDataSourceSrv().getInstanceSettings(queryRunner.state.datasource);

  if (ds?.meta.id !== 'prometheus') {
    return;
  }

  const queries = queryRunner.state.queries.map((q) => q.expr).filter(isString);

  const queryMetrics = getQueryMetrics(queries);

  const subMenu: PanelMenuItem[] = queryMetrics.map((item) => {
    return {
      text: getQueryMetricLabel(item),
      onClick: createClickHandler(item, dashboard, ds),
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

function createClickHandler(item: QueryMetric, dashboard: DashboardScene | DashboardModel, ds: DataSourceRef) {
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

  if (dashboard instanceof DashboardScene) {
    return () => {
      const drawerScene = new SceneDrawerAsScene({
        ...commonProps,
        onClose: () => dashboard.closeModal(),
      });
      dashboard.showModal(drawerScene);
    };
  } else {
    return () => launchSceneDrawerInGlobalModal(commonProps);
  }
}
