import { defaults, each, sortBy } from 'lodash';

import { DataSourceRef, PanelPluginMeta } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { isConstant, isQuery } from '../../../variables/guard';
import { VariableOption, VariableRefresh } from '../../../variables/types';
import { DashboardModel } from '../../state/DashboardModel';
import { GridPos } from '../../state/PanelModel';

interface Input {
  name: string;
  type: string;
  label: string;
  value: any;
  description: string;
}

interface Requires {
  [key: string]: {
    type: string;
    id: string;
    name: string;
    version: string;
  };
}

interface ExternalDashboard {
  __inputs: Input[];
  __elements: Record<string, LibraryElementExport>;
  __requires: Array<Requires[string]>;
  panels: Array<PanelModel | PanelWithExportableLibraryPanel>;
}

interface PanelWithExportableLibraryPanel {
  gridPos: GridPos;
  id: number;
  libraryPanel: {
    name: string;
    uid: string;
  };
}

function isExportableLibraryPanel(p: any): p is PanelWithExportableLibraryPanel {
  return p.libraryPanel && typeof p.libraryPanel.name === 'string' && typeof p.libraryPanel.uid === 'string';
}

interface DataSources {
  [key: string]: {
    name: string;
    label: string;
    description: string;
    type: string;
    pluginId: string;
    pluginName: string;
  };
}

export interface LibraryElementExport {
  name: string;
  uid: string;
  model: any;
  kind: LibraryElementKind;
}

export class DashboardExporter {
  async makeExportable(dashboard: DashboardModel) {
    // clean up repeated rows and panels,
    // this is done on the live real dashboard instance, not on a clone
    // so we need to undo this
    // this is pretty hacky and needs to be changed
    dashboard.cleanUpRepeats();

    const saveModel = dashboard.getSaveModelClone();
    saveModel.id = null;

    // undo repeat cleanup
    dashboard.processRepeats();

    const inputs: Input[] = [];
    const requires: Requires = {};
    const datasources: DataSources = {};
    const variableLookup: { [key: string]: any } = {};
    const libraryPanels: Map<string, LibraryElementExport> = new Map<string, LibraryElementExport>();

    for (const variable of saveModel.getVariables()) {
      variableLookup[variable.name] = variable;
    }

    const templateizeDatasourceUsage = (obj: any, fallback?: DataSourceRef) => {
      if (obj.datasource === undefined) {
        obj.datasource = fallback;
        return;
      }

      let datasource: string = obj.datasource;
      let datasourceVariable: any = null;

      const datasourceUid: string = (datasource as any)?.uid;
      // ignore data source properties that contain a variable
      if (datasourceUid) {
        if (datasourceUid.indexOf('$') === 0) {
          datasourceVariable = variableLookup[datasourceUid.substring(1)];
          if (datasourceVariable && datasourceVariable.current) {
            datasource = datasourceVariable.current.value;
          }
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

          const refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase();
          datasources[refName] = {
            name: refName,
            label: ds.name,
            description: '',
            type: 'datasource',
            pluginId: ds.meta?.id,
            pluginName: ds.meta?.name,
          };

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
        if (isQuery(variable)) {
          await templateizeDatasourceUsage(variable);
          variable.options = [];
          variable.current = {} as unknown as VariableOption;
          variable.refresh =
            variable.refresh !== VariableRefresh.never ? variable.refresh : VariableRefresh.onDashboardLoad;
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
        await processLibraryPanels(panel);
        if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
          for (const rowPanel of panel.panels) {
            await processLibraryPanels(rowPanel);
          }
        }
      }

      each(datasources, (value: any) => {
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
      const newObj: ExternalDashboard = defaults(
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
