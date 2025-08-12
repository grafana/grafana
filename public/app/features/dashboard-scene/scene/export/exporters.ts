import { defaults, each, sortBy } from 'lodash';

import { DataSourceRef, PanelPluginMeta, VariableOption, VariableRefresh } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import {
  Spec as DashboardV2Spec,
  PanelKind,
  PanelQueryKind,
  AnnotationQueryKind,
  QueryVariableKind,
  LibraryPanelRef,
  LibraryPanelKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { notifyApp } from 'app/core/actions';
import config from 'app/core/config';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { buildPanelKind } from 'app/features/dashboard/api/ResponseTransformers';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel, GridPos } from 'app/features/dashboard/state/PanelModel';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { variableRegex } from 'app/features/variables/utils';
import { dispatch } from 'app/store/store';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { DashboardJson } from '../../../manage-dashboards/types';
import { isConstant } from '../../../variables/guard';

export interface InputUsage {
  libraryPanels?: LibraryPanelRef[];
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
  libraryPanel: LibraryPanelRef;
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

export interface LibraryElementExport {
  name: string;
  uid: string;
  model: any;
  kind: LibraryElementKind;
}

export async function makeExportableV1(dashboard: DashboardModel) {
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

        console.log('obj - after', obj);
        obj.datasource = { type: ds.meta.id, uid: '${' + refName + '}' };
      });
  };

  const processPanel = async (panel: PanelModel) => {
    if (panel.type !== 'row') {
      console.log('running panel');
      await templateizeDatasourceUsage(panel);

      if (panel.targets) {
        for (const target of panel.targets) {
          console.log('running target', {
            target,
          });
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
      console.log('calling panel in try', { panel });
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
      } else if (variable.type === 'adhoc') {
        await templateizeDatasourceUsage(variable);
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

/**
 * Converts a LibraryPanelKind to a PanelKind with embedded panel configuration
 */
async function convertLibraryPanelToInlinePanel(libraryPanelElement: LibraryPanelKind): Promise<PanelKind> {
  const { libraryPanel, id, title } = libraryPanelElement.spec;

  try {
    // Load the full library panel definition
    const fullLibraryPanel = await getLibraryPanel(libraryPanel.uid, true);
    const panelModel: Panel = fullLibraryPanel.model;
    const inlinePanel = buildPanelKind(panelModel);
    // keep the original id
    inlinePanel.spec.id = id;
    return inlinePanel;
  } catch (error) {
    console.error(`Failed to load library panel ${libraryPanel.uid}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dispatch(
      notifyApp(
        createErrorNotification(
          `Unable to load library panel "${libraryPanel.name}": ${errorMessage}. It will appear as a placeholder in the export.`
        )
      )
    );

    // Return a placeholder panel if library panel can't be loaded
    return {
      kind: 'Panel',
      spec: {
        id,
        title: title || `Library Panel: ${libraryPanel.name}`,
        description: '',
        links: [],
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: [],
            transformations: [],
            queryOptions: {},
          },
        },
        vizConfig: {
          kind: 'VizConfig',
          group: 'text',
          version: '',
          spec: {
            options: {
              content: `**Library Panel Load Error**\n\nUnable to load library panel: ${libraryPanel.name} (${libraryPanel.uid})\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
              mode: 'markdown',
            },
            fieldConfig: { defaults: {}, overrides: [] },
          },
        },
      },
    };
  }
}

export async function makeExportableV2(dashboard: DashboardV2Spec, isSharingExternally = false) {
  const variableLookup: { [key: string]: any } = {};

  // get all datasource variables
  const datasourceVariables = dashboard.variables.filter((v) => v.kind === 'DatasourceVariable');

  for (const variable of dashboard.variables) {
    variableLookup[variable.spec.name] = variable.spec;
  }

  const removeDataSourceRefs = (
    obj: AnnotationQueryKind['spec'] | QueryVariableKind['spec'] | PanelQueryKind['spec']
  ) => {
    const datasourceUid = obj.query?.datasource?.name;

    if (datasourceUid?.startsWith('${') && datasourceUid?.endsWith('}')) {
      const varName = datasourceUid.slice(2, -1);
      // if there's a match we don't want to remove the datasource ref
      const match = datasourceVariables.find((v) => v.spec.name === varName);
      if (match) {
        return;
      }
    }

    obj.query && (obj.query.datasource = undefined);
  };

  const processPanel = (panel: PanelKind) => {
    if (panel.spec.data.spec.queries) {
      for (const query of panel.spec.data.spec.queries) {
        removeDataSourceRefs(query.spec);
      }
    }
  };

  try {
    const elements = dashboard.elements;

    // process elements
    for (const [key, element] of Object.entries(elements)) {
      if (element.kind === 'Panel') {
        processPanel(element);
      } else if (element.kind === 'LibraryPanel') {
        if (isSharingExternally) {
          // Convert library panel to inline panel for external sharing
          const inlinePanel = await convertLibraryPanelToInlinePanel(element);
          // Apply datasource templating to the converted panel
          processPanel(inlinePanel);
          // Replace the library panel with the inline panel
          elements[key] = inlinePanel;
        }
        // For internal exports, keep library panels as-is
      }
    }

    // process template variables
    for (const variable of dashboard.variables) {
      if (variable.kind === 'QueryVariable') {
        removeDataSourceRefs(variable.spec);
        variable.spec.options = [];
        variable.spec.current = {
          text: '',
          value: '',
        };
      } else if (variable.kind === 'DatasourceVariable') {
        variable.spec.current = {
          text: '',
          value: '',
        };
      }
    }

    // process annotations vars
    for (const annotation of dashboard.annotations) {
      removeDataSourceRefs(annotation.spec);
    }

    return dashboard;
  } catch (err) {
    console.error('Export failed:', err);
    return {
      error: err,
    };
  }
}
