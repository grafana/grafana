import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardDTO } from 'app/types';

import { VizPanel, SceneTimePicker, SceneGridLayout, SceneGridRow } from '../components';
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

    const dashboard = new DashboardScene({
      title: oldModel.title,
      uid: oldModel.uid,
      layout: new SceneGridLayout({
        children: this.buildSceneObjectsFromDashboard(oldModel),
      }),
      $timeRange: new SceneTimeRange(oldModel.time),
      actions: [new SceneTimePicker({})],
    });

    // We initialize URL sync here as it better to do that before mounting and doing any rendering.
    // But would be nice to have a conditional around this so you can pre-load dashboards without url sync.
    dashboard.initUrlSync();

    this.cache[rsp.dashboard.uid] = dashboard;
    this.setState({ dashboard, isLoading: false });
  }

  private buildSceneObjectsFromDashboard(dashboard: DashboardModel) {
    // collects all panels and rows
    const panels: SceneObject[] = [];

    // indicates expanded row that's currently processed
    let currentRow: PanelModel | null = null;
    // collects panels in the currently processed, expanded row
    let currentRowPanels: SceneObject[] = [];

    for (const panel of dashboard.panels) {
      if (panel.type === 'row') {
        if (!currentRow) {
          if (Boolean(panel.collapsed)) {
            // collapsed rows contain their panels within the row model
            panels.push(
              new SceneGridRow({
                title: panel.title,
                isCollapsed: true,
                size: {
                  y: panel.gridPos.y,
                },
                children: panel.panels ? panel.panels.map(createVizPanelFromPanelModel) : [],
              })
            );
          } else {
            // indicate new row to be processed
            currentRow = panel;
          }
        } else {
          // when a row has been processed, and we hit a next one for processing
          if (currentRow.id !== panel.id) {
            // commit previous row panels
            panels.push(
              new SceneGridRow({
                title: currentRow!.title,
                size: {
                  y: currentRow.gridPos.y,
                },
                children: currentRowPanels,
              })
            );

            currentRow = panel;
            currentRowPanels = [];
          }
        }
      } else {
        const panelObject = createVizPanelFromPanelModel(panel);

        // when processing an expanded row, collect its panels
        if (currentRow) {
          currentRowPanels.push(panelObject);
        } else {
          panels.push(panelObject);
        }
      }
    }

    // commit a row if it's the last one
    if (currentRow) {
      panels.push(
        new SceneGridRow({
          title: currentRow!.title,
          size: {
            y: currentRow.gridPos.y,
          },
          children: currentRowPanels,
        })
      );
    }

    return panels;
  }
}

function createVizPanelFromPanelModel(panel: PanelModel) {
  return new VizPanel({
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
    pluginVersion: panel.pluginVersion,
    $data: new SceneQueryRunner({
      queries: panel.targets,
      timeFrom: panel.timeFrom,
      timeShift: panel.timeShift,
      maxDataPoints: panel.maxDataPoints,
    }),
  });
}

let loader: DashboardLoader | null = null;

export function getDashboardLoader(): DashboardLoader {
  if (!loader) {
    loader = new DashboardLoader({});
  }

  return loader;
}
