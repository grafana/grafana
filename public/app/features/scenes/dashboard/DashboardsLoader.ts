import { CustomVariableModel, DataSourceVariableModel, QueryVariableModel } from '@grafana/data';
import { VariableModel } from '@grafana/schema';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardDTO } from 'app/types';

import { VizPanel, SceneTimePicker, SceneGridLayout, SceneGridRow, SceneSubMenu } from '../components';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneObject } from '../core/types';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { SceneVariable } from '../variables/types';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { DataSourceVariable } from '../variables/variants/DataSourceVariable';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

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

    let subMenu: SceneSubMenu | undefined = undefined;
    let variables: SceneVariableSet | undefined = undefined;

    if (oldModel.templating.list.length) {
      const variableObjects = this.migrateVariables(oldModel);
      subMenu = new SceneSubMenu({
        children: [new VariableValueSelectors({})],
      });
      variables = new SceneVariableSet({
        variables: variableObjects,
      });
    }

    const dashboard = new DashboardScene({
      title: oldModel.title,
      uid: oldModel.uid,
      layout: new SceneGridLayout({
        children: this.buildSceneObjectsFromDashboard(oldModel),
      }),
      $timeRange: new SceneTimeRange(),
      actions: [new SceneTimePicker({})],
      $variables: variables,
      subMenu,
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

  private migrateVariables(dashboard: DashboardModel) {
    return (
      dashboard.templating.list
        .map((v) => {
          try {
            return createVariableFromLegacyModel(v);
          } catch (err) {
            console.error(err);
            return null;
          }
        })
        // TODO: Remove filter
        // Added temporarily to allow skipping non-compatible variables
        .filter((v): v is SceneVariable => Boolean(v))
    );
  }
}

export function createVariableFromLegacyModel(variable: VariableModel): SceneVariable {
  const commonProperties = {
    name: variable.name,
    label: variable.label,
  };
  if (isCustomVariable(variable)) {
    return new CustomVariable({
      ...commonProperties,
      value: variable.current.value,
      text: variable.current.text,
      description: variable.description,
      query: variable.query,
      isMulti: variable.multi,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
    });
  } else if (isQueryVariable(variable)) {
    return new QueryVariable({
      ...commonProperties,
      value: variable.current.value,
      text: variable.current.text,
      description: variable.description,
      query: variable.query,
      datasource: variable.datasource,
      sort: variable.sort,
      refresh: variable.refresh,
      regex: variable.regex,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      isMulti: variable.multi,
      skipUrlSync: variable.skipUrlSync,
    });
  } else if (isDataSourceVariable(variable)) {
    return new DataSourceVariable({
      ...commonProperties,
      value: variable.current.value,
      text: variable.current.text,
      regex: variable.regex,
      query: variable.query,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
      isMulti: variable.multi,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.type}`);
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

const isCustomVariable = (v: VariableModel): v is CustomVariableModel => v.type === 'custom';
const isQueryVariable = (v: VariableModel): v is QueryVariableModel => v.type === 'query';
const isDataSourceVariable = (v: VariableModel): v is DataSourceVariableModel => v.type === 'datasource';
