import { getDefaultTimeRange } from '@grafana/data';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardDTO } from 'app/types';

import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneGridLayout } from '../components/layout/SceneGridLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneObject } from '../core/types';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

import { DashboardScene } from './DashboardScene';

export interface DashboardLoaderState {
  dashboard?: DashboardScene;
  isLoading?: boolean;
  loadError?: string;
}

export class DashboardLoader extends StateManagerBase<DashboardLoaderState> {
  private cache: Record<string, DashboardScene> = {};

  public async load(uid: string) {
    const fromCache = this.cache[uid];
    if (fromCache) {
      this.setState({ dashboard: fromCache });
      return;
    }

    this.setState({ isLoading: true });

    try {
      const rsp = await dashboardLoaderSrv.loadDashboard('db', '', uid);

      if (rsp.dashboard) {
        this.initDashboard(rsp);
      } else {
        throw new Error('No dashboard returned');
      }
    } catch (err) {
      this.setState({ isLoading: false, loadError: String(err) });
    }
  }

  private initDashboard(rsp: DashboardDTO) {
    // Just to have migrations run
    const oldModel = new DashboardModel(rsp.dashboard, rsp.meta);
    const panels: SceneObject[] = [];

    for (const panel of oldModel.panels) {
      if (panel.type === 'row') {
        continue;
      }

      panels.push(
        new VizPanel({
          title: panel.title,
          pluginId: panel.type,
          size: {
            x: panel.gridPos.x,
            y: panel.gridPos.y,
            width: panel.gridPos.w,
            height: panel.gridPos.h,
          },
          options: panel.options,
          fieldConfig: panel.fieldConfig,
          $data: new SceneQueryRunner({
            queries: panel.targets,
          }),
        })
      );
    }

    const dashboard = new DashboardScene({
      title: oldModel.title,
      uid: oldModel.uid,
      layout: new SceneGridLayout({
        children: panels,
      }),
      $timeRange: new SceneTimeRange(getDefaultTimeRange()),
      actions: [new SceneTimePicker({})],
    });

    this.cache[rsp.dashboard.uid] = dashboard;
    this.setState({ dashboard, isLoading: false });
  }
}

let loader: DashboardLoader | null = null;

export function getDashboardLoader(): DashboardLoader {
  if (!loader) {
    loader = new DashboardLoader({});
  }

  return loader;
}
