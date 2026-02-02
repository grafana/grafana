import { defaults, each, sortBy } from 'lodash';

import { DataSourceRef, PanelPluginMeta, VariableOption, VariableRefresh } from '@grafana/data';
import { getDataSourceSrv, getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { variableRegex } from 'app/features/variables/utils';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { DashboardJson } from '../../../manage-dashboards/types';
import { isConstant } from '../../../variables/guard';
import { DashboardModel } from '../../state/DashboardModel';
import { GridPos } from '../../state/PanelModel';

export interface InputUsage {
  libraryPanels?: LibraryPanel[];
}

export interface LibraryPanel {
  name: string;
  uid: string;
}
export interface Input {
  name: string;
  type: string;
  label: string;
  value: any;
  description: string;
  usage?: InputUsage;
}

interface Requires {
  [key: string]: {
    type: string;
    id: string;
    name: string;
    version: string;
  };
}

export interface ExternalDashboard {
  __inputs?: Input[];
  __elements?: Record<string, LibraryElementExport>;
  __requires?: Array<Requires[string]>;
  panels: Array<PanelModel | PanelWithExportableLibraryPanel>;
}

interface PanelWithExportableLibraryPanel {
  gridPos: GridPos;
  id: number;
  libraryPanel: LibraryPanel;
}

function isExportableLibraryPanel(
  p: PanelModel | PanelWithExportableLibraryPanel
): p is PanelWithExportableLibraryPanel {
  return Boolean(p.libraryPanel?.name && p.libraryPanel?.uid);
}

interface DataSources {
  [key: string]: {
    name: string;
    label: string;
    description: string;
    type: string;
    pluginId: string;
    pluginName: string;
    usage?: InputUsage;
  };
}

// BMC Code

const VQBView = {
  GET_VIEW_LIST: '/api/rmsmetadata/view/list',
  VQB_VIEW_TYPE: 'Views',
  HELIX_DATASOURCE: 'bmchelix-ade-datasource',
  INPUT_VIEW_TYPE: 'view',
};

// BMC Code Ends

export interface LibraryElementExport {
  name: string;
  uid: string;
  model: any;
  kind: LibraryElementKind;
}

// BMC Code: start
type ViewListItem = { label: string; value: number };
type ViewListType = { id: number; itsmCompVersion: string; name: string; deleted: boolean };
// BMC Code: end

export class DashboardExporter {
  async makeExportable(dashboard: DashboardModel) {
    // clean up repeated rows and panels,
    // this is done on the live real dashboard instance, not on a clone
    // so we need to undo this
    // this is pretty hacky and needs to be changed
    dashboard.cleanUpRepeats();

    const saveModel = dashboard.getSaveModelCloneOld();
    saveModel.id = null;

    // undo repeat cleanup
    dashboard.processRepeats();

    const inputs: Input[] = [];
    const requires: Requires = {};
    const datasources: DataSources = {};
    const viewVQBList: any = {};
    const variableLookup: { [key: string]: any } = {};
    const libraryPanels: Map<string, LibraryElementExport> = new Map<string, LibraryElementExport>();
    const viewList: ViewListItem[] = [];

    for (const variable of saveModel.getVariables()) {
      variableLookup[variable.name] = variable;
    }

    const templateizeDatasourceUsage = (obj: any, fallback?: DataSourceRef) => {
      if (obj.datasource === undefined) {
        obj.datasource = fallback;
        return;
      }

      let datasource = obj.datasource;
      let datasourceVariable: any = null;

      const datasourceUid: string | undefined = datasource?.uid;
      const match = datasourceUid && variableRegex.exec(datasourceUid);

      // ignore data source properties that contain a variable
      if (match) {
        const varName = match[1] || match[2] || match[4];
        datasourceVariable = variableLookup[varName];
        if (datasourceVariable && datasourceVariable.current) {
          datasource = datasourceVariable.current.value;
        }
      }

      return getDataSourceSrv()
        .get(datasource)
        .then((ds) => {
          if (ds.meta?.builtIn) {
            return;
          }

          // add data source type to require list
          requires['datasource' + ds.meta?.id] = {
            type: 'datasource',
            id: ds.meta.id,
            name: ds.meta.name,
            version: ds.meta.info.version || '1.0.0',
          };

          // if used via variable we can skip templatizing usage
          if (datasourceVariable) {
            return;
          }

          const libraryPanel = obj.libraryPanel;
          const libraryPanelSuffix = !!libraryPanel ? '-for-library-panel' : '';
          let refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase() + libraryPanelSuffix.toUpperCase();

          datasources[refName] = {
            name: refName,
            label: ds.name,
            description: '',
            type: 'datasource',
            pluginId: ds.meta?.id,
            pluginName: ds.meta?.name,
            usage: datasources[refName]?.usage,
          };

          if (!!libraryPanel) {
            const libPanels = datasources[refName]?.usage?.libraryPanels || [];
            libPanels.push({ name: libraryPanel.name, uid: libraryPanel.uid });

            datasources[refName].usage = {
              libraryPanels: libPanels,
            };
          }

          obj.datasource = { type: ds.meta.id, uid: '${' + refName + '}' };
        });
    };

    const processPanel = async (panel: PanelModel) => {
      if (panel.type !== 'row') {
        await templateizeDatasourceUsage(panel);

        if (panel.targets) {
          for (const target of panel.targets) {
            await templateizeDatasourceUsage(target, panel.datasource!);
          }
        }

        const panelDef: PanelPluginMeta = config.panels[panel.type];
        if (panelDef) {
          requires['panel' + panelDef.id] = {
            type: 'panel',
            id: panelDef.id,
            name: panelDef.name,
            version: panelDef.info.version,
          };
        }
      }
    };

    const processLibraryPanels = async (panel: PanelModel) => {
      if (isPanelModelLibraryPanel(panel)) {
        const { name, uid } = panel.libraryPanel;
        let model = panel.libraryPanel.model;
        if (!model) {
          const libPanel = await getLibraryPanel(uid, true);
          model = libPanel.model;
        }

        await templateizeDatasourceUsage(model);

        const { gridPos, id, ...rest } = model as any;
        if (!libraryPanels.has(uid)) {
          libraryPanels.set(uid, { name, uid, kind: LibraryElementKind.Panel, model: rest });
        }
      }
    };

    // BMC Code: starts
    const getViewList = async () => {
      const data: ViewListType[] = await getBackendSrv().get(VQBView.GET_VIEW_LIST);
      // Fix for 25.3 filtering a view "Configuration Management GenAI Ready",
      // VQB does not support as of 25.3
      const skipView = 'Configuration Management GenAI Ready';
      return Array.isArray(data)
        ? data.filter((i) => !i.deleted && i.name !== skipView ).map((item) => ({ label: item.name, value: item.id }))
        : [];
    };

    const updateVQBInputs = async (sourceQuery: any) => {
      let selectedView = sourceQuery.view?.selectedView;
      if (typeof selectedView !== 'object') {
        if (viewList.length === 0) {
          viewList.push(...(await getViewList()));
        }
        const currentView = viewList.find((item) => item.value === selectedView);
        selectedView = sourceQuery.view.selectedView = {
          viewId: currentView?.value || selectedView,
          viewName: currentView?.label || '',
        };
      }
      const refName = `VIEW_${selectedView.viewName.replace(' ', '_').toUpperCase()}`;
      if (!viewVQBList.hasOwnProperty(refName)) {
        viewVQBList[refName] = {
          name: refName,
          label: selectedView.viewName,
          id: selectedView.viewId,
          description: '',
          type: 'view',
        };
      }
    };
    // BMC Code: ends

    try {
      // check up panel data sources
      for (const panel of saveModel.panels) {
        await processPanel(panel);

        // handle collapsed rows
        if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
          for (const rowPanel of panel.panels) {
            await processPanel(rowPanel);
          }
        }
      }

      // templatize template vars
      for (const variable of saveModel.getVariables()) {
        if (variable.type === 'query') {
          await templateizeDatasourceUsage(variable);
          variable.options = [];
          variable.current = {} as unknown as VariableOption;
          variable.refresh =
            variable.refresh !== VariableRefresh.never ? variable.refresh : VariableRefresh.onDashboardLoad;
        } else if (variable.type === 'datasource') {
          variable.current = {};
        }
      }

      // templatize annotations vars
      for (const annotationDef of saveModel.annotations.list) {
        await templateizeDatasourceUsage(annotationDef);
      }

      // add grafana version
      requires['grafana'] = {
        type: 'grafana',
        id: 'grafana',
        name: 'Grafana',
        version: config.buildInfo.version,
      };

      // we need to process all panels again after all the promises are resolved
      // so all data sources, variables and targets have been templateized when we process library panels
      for (const panel of saveModel.panels) {
        // BMC Code: start
        // We will construct the inputs in case of helix VQB view.
        if (panel?.datasource?.type === VQBView.HELIX_DATASOURCE) {
          const childPanelList = panel?.targets || [];

          for (const childPanel of childPanelList) {
            const sourceQuery = childPanel?.sourceQuery;
            if (sourceQuery?.queryType === VQBView.VQB_VIEW_TYPE) {
              updateVQBInputs(sourceQuery);
            }
          }
        }
        // END VQB view inputs
        // // BMC Code: end
        await processLibraryPanels(panel);
        if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
          for (const rowPanel of panel.panels) {
            await processLibraryPanels(rowPanel);
          }
        }
      }

      // BMC Code: starts
      for (const list of saveModel?.templating?.list) {
        const sourceQuery = list?.query?.sourceQuery;
        if (sourceQuery?.queryType === VQBView.VQB_VIEW_TYPE) {
          updateVQBInputs(sourceQuery);
        }
      }
      // BMC Code: ends

      each(datasources, (value: any) => {
        inputs.push(value);
      });
      // BMC Code
      each(viewVQBList, (value: any) => {
        inputs.push(value);
      });

      // templatize constants
      for (const variable of saveModel.getVariables()) {
        if (isConstant(variable)) {
          const refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
          inputs.push({
            name: refName,
            type: 'constant',
            label: variable.label || variable.name,
            value: variable.query,
            description: '',
          });
          // update current and option
          variable.query = '${' + refName + '}';
          variable.current = {
            value: variable.query,
            text: variable.query,
            selected: false,
          };
          variable.options = [variable.current];
        }
      }

      const __elements = [...libraryPanels.entries()].reduce<Record<string, LibraryElementExport>>(
        (prev, [curKey, curLibPanel]) => {
          prev[curKey] = curLibPanel;
          return prev;
        },
        {}
      );

      // make inputs and requires a top thing
      const newObj: DashboardJson = defaults(
        {
          __inputs: inputs,
          __elements,
          __requires: sortBy(requires, ['id']),
        },
        saveModel
      );

      // Remove extraneous props from library panels
      for (let i = 0; i < newObj.panels.length; i++) {
        const libPanel = newObj.panels[i];
        if (isExportableLibraryPanel(libPanel)) {
          newObj.panels[i] = {
            gridPos: libPanel.gridPos,
            id: libPanel.id,
            libraryPanel: { uid: libPanel.libraryPanel.uid, name: libPanel.libraryPanel.name },
          };
        }
      }

      return newObj;
    } catch (err) {
      console.error('Export failed:', err);
      return {
        error: err,
      };
    }
  }
}
