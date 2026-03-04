import { useEffect, useMemo } from 'react';

import {
  useProvidePageContext,
  createAssistantContextItem,
  ChatContextItem,
  newFunctionNamespace,
  getExposeAssistantFunctionsConfig,
} from '@grafana/assistant';
import { getDataSourceRef } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer, sceneGraph, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';

import { getPluginExtensionRegistries } from '../../plugins/extensions/registry/setup';
import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { VizPanelHeaderActions } from '../scene/VizPanelHeaderActions';
import { VizPanelSubHeader } from '../scene/VizPanelSubHeader';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import {
  findVizPanelByKey,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

interface DashboardAIContextProviderProps {
  dashboard: DashboardScene;
}

function buildPanelContextItems(panels: VizPanel[]): ChatContextItem[] {
  return panels.map((panel) => {
    const panelId = getPanelIdForVizPanel(panel);
    const dataProvider = panel.state.$data;
    let datasourceInfo: { uid?: string; type?: string } | undefined;

    if (dataProvider instanceof SceneQueryRunner) {
      const ds = dataProvider.state.datasource;
      if (ds) {
        datasourceInfo = { uid: ds.uid, type: ds.type };
      }
    }

    return createAssistantContextItem('structured', {
      title: `Panel: ${panel.state.title || 'Untitled'}`,
      data: {
        panelId,
        title: panel.state.title,
        description: panel.state.description,
        pluginId: panel.state.pluginId,
        ...(datasourceInfo && { datasource: datasourceInfo }),
      },
    });
  });
}

function buildDatasourceContextItems(panels: VizPanel[]): ChatContextItem[] {
  const seen = new Set<string>();
  const items: ChatContextItem[] = [];

  for (const panel of panels) {
    const dataProvider = panel.state.$data;
    if (dataProvider instanceof SceneQueryRunner) {
      const uid = dataProvider.state.datasource?.uid;
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        items.push(
          createAssistantContextItem('datasource', {
            datasourceUid: uid,
          })
        );
      }
    }
  }

  return items;
}

function buildVariableContextItems(dashboard: DashboardScene): ChatContextItem[] {
  const variableSet = sceneGraph.getVariables(dashboard);
  if (!variableSet) {
    return [];
  }

  const variables = variableSet.state.variables;
  if (variables.length === 0) {
    return [];
  }

  return [
    createAssistantContextItem('structured', {
      title: 'Dashboard Variables',
      data: {
        variables: variables.map((v) => ({
          name: v.state.name,
          type: v.state.type,
          label: v.state.label,
          value: v.getValue?.(),
        })),
      },
    }),
  ];
}

function buildLayoutContextItem(dashboard: DashboardScene): ChatContextItem {
  const layoutManager = dashboard.state.body;

  return createAssistantContextItem('structured', {
    title: 'Dashboard Layout',
    data: {
      layoutType: layoutManager.descriptor.name,
      panelCount: layoutManager.getVizPanels().length,
    },
  });
}

function buildDashboardMetadataItem(dashboard: DashboardScene): ChatContextItem {
  return createAssistantContextItem('structured', {
    title: `Dashboard: ${dashboard.state.title}`,
    hidden: true,
    data: {
      uid: dashboard.state.uid,
      title: dashboard.state.title,
      description: dashboard.state.description,
      tags: dashboard.state.tags,
      isEditing: dashboard.state.isEditing,
      editable: dashboard.state.editable,
    },
  });
}

function useDashboardContextItems(dashboard: DashboardScene): ChatContextItem[] {
  const { title, description, tags, isEditing, body, uid } = dashboard.useState();
  const panels = body.getVizPanels();

  return useMemo(() => {
    const items: ChatContextItem[] = [];

    items.push(buildDashboardMetadataItem(dashboard));
    items.push(buildLayoutContextItem(dashboard));
    items.push(...buildPanelContextItems(panels));
    items.push(...buildDatasourceContextItems(panels));
    items.push(...buildVariableContextItems(dashboard));

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, title, description, tags, isEditing, uid, panels]);
}

function buildVizPanel(type: string, title: string, datasource?: string, query?: string): VizPanel {
  const pluginId = type || 'timeseries';
  const dsSettings = datasource
    ? getDataSourceSrv().getInstanceSettings(datasource)
    : getDataSourceSrv().getInstanceSettings(null);

  const queryRunner = dsSettings
    ? new SceneQueryRunner({
        queries: [{ refId: 'A', ...(query ? { expr: query, rawSql: query, query } : {}) }],
        datasource: getDataSourceRef(dsSettings),
        $behaviors: [new DashboardDatasourceBehaviour({})],
      })
    : undefined;

  return new VizPanel({
    title,
    pluginId,
    seriesLimit: config.panelSeriesLimit,
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    hoverHeaderOffset: 0,
    $behaviors: [],
    subHeader: new VizPanelSubHeader({
      hideNonApplicableDrilldowns: !config.featureToggles.perPanelNonApplicableDrilldowns,
    }),
    extendPanelContext: setDashboardPanelContext,
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    headerActions: new VizPanelHeaderActions({
      hideGroupByAction: !config.featureToggles.panelGroupBy,
    }),
    $data: queryRunner
      ? new SceneDataTransformer({ $data: queryRunner, transformations: [] })
      : undefined,
  });
}

function useDashboardFunctions(dashboard: DashboardScene) {
  useEffect(() => {
    const dashboardNamespace = newFunctionNamespace('dashboard', {
      addPanel: (type: string, title: string, datasource?: string, query?: string) => {
        const vizPanel = buildVizPanel(type, title, datasource, query);
        dashboard.addPanel(vizPanel);
      },

      removePanel: (panelId: number) => {
        const panel = findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(panelId));
        if (panel) {
          dashboard.removePanel(panel);
        }
      },

      updatePanelQuery: (panelId: number, query: string) => {
        const panel = findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(panelId));
        if (!panel) {
          return;
        }
        const queryRunner = getQueryRunnerFor(panel);
        if (!queryRunner) {
          return;
        }
        const existingQueries = queryRunner.state.queries;
        const updatedQueries = existingQueries.length > 0
          ? existingQueries.map((q, i) => (i === 0 ? { ...q, expr: query, rawSql: query, query } : q))
          : [{ refId: 'A', expr: query, rawSql: query, query }];
        queryRunner.setState({ queries: updatedQueries });
        queryRunner.runQueries();
      },

      setDashboardTitle: (title: string) => {
        dashboard.setState({ title });
      },

      setDashboardDescription: (description: string) => {
        dashboard.setState({ description });
      },
    });

    const functionsConfig = getExposeAssistantFunctionsConfig([dashboardNamespace]);

    getPluginExtensionRegistries().then((registries) => {
      registries.addedFunctionsRegistry.register({
        pluginId: 'grafana',
        configs: [functionsConfig],
      });
    });
  }, [dashboard]);
}

export function DashboardAIContextProvider({ dashboard }: DashboardAIContextProviderProps) {
  const contextItems = useDashboardContextItems(dashboard);

  const setDashboardContext = useProvidePageContext('/d/*', contextItems);
  const setNewDashboardContext = useProvidePageContext('/dashboard/new', contextItems);

  useEffect(() => {
    setDashboardContext(contextItems);
    setNewDashboardContext(contextItems);
  }, [contextItems, setDashboardContext, setNewDashboardContext]);

  useDashboardFunctions(dashboard);

  return null;
}
