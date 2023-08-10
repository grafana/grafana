import { chain, cloneDeep, defaults, find } from 'lodash';

import { PanelPluginMeta } from '@grafana/data';
import { llms } from '@grafana/experimental';
import { Dashboard } from '@grafana/schema';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { calculateNewPanelGridPos } from 'app/features/dashboard/utils/panel';

import { getGeneratePayloadForPanels } from '../components/PanelEditor/utils';

export function onCreateNewPanel(dashboard: DashboardModel, datasource?: string): number | undefined {
  const newPanel: Partial<PanelModel> = {
    type: 'timeseries',
    title: 'Panel Title',
    gridPos: calculateNewPanelGridPos(dashboard),
    datasource: datasource ? { uid: datasource } : null,
    isNew: true,
  };

  dashboard.addPanel(newPanel);
  return newPanel.id;
}

// If generating with AI consider using the dashboard model to improve suggestions quality
export function onGeneratePanelWithAI(dashboard: DashboardModel, description: string): any {
  const payload = getGeneratePayloadForPanels(dashboard);

  return llms.openai
    .chatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an API that only respond with JSON',
        },
        {
          role: 'system',
          content: 'Your goal is to generate a valid Grafana panel JSON with the provided requirements',
        },
        {
          role: 'system',
          content: 'DO NOT explain the panel, only answer with a valid panel JSON',
        },
        {
          role: 'system',
          content: 'Use the following panels as context to generate the new panels',
        },
        // @ts-ignore
        ...payload.panels.map((panel) => ({
          role: 'system',
          content: JSON.stringify(panel),
        })),
        {
          // @ts-ignore
          role: 'user',
          content: description,
        },
      ],
    })
    .then((response: any) => response.choices[0].message.content);
}

// Generate panels using semantic search on Grafana panels database
export function onGenerateDashboardWithSemanticSearch(query: string): any {
  return fetch('http://18.116.13.121:9044/get_dashboards/', {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //mode: "no-cors", // no-cors, *cors, same-origin
    // cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    // credentials: "same-origin", // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({ query }), // body data type must match "Content-Type" header
  })
    .then((res) => res.json())
    .then((response) => {
      // It returns 5 dashboards sorted by relevance, for now we pick only the first one
      const bestMatch = response.dashboards[0][0];
      const dashboard = JSON.parse(bestMatch);

      return dashboard;
    });
}

export const checkDashboardResultQuality = (dashboard: DashboardModel, query: string) => {
  return llms.openai
    .chatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an API that only respond with "YES" or "NO"',
        },
        {
          role: 'system',
          content: 'Your goal is to judge whether or a Grafana dashboard JSON is a good result for the query',
        },
        {
          role: 'system',
          content: 'If the dashboard is a good result, answer with "YES", otherwise answer with "NO"',
        },
        {
          role: 'system',
          content: `The query is: "${query}" and the dashboard is: ${JSON.stringify(dashboard)}`,
        },
      ],
    })
    .then((response: any) => response.choices[0].message.content)
    .then((content: string) => {
      return content === 'YES';
    });
};

export function onGenerateDashboardWithAI(description: string): any {
  return llms.openai
    .chatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an API that only respond with JSON',
        },
        {
          role: 'system',
          content: 'Your goal is to generate a valid Grafana dashboard JSON with the provided requirements',
        },
        {
          role: 'system',
          content: 'Do not organize the panels by rows, only a list of panels',
        },
        {
          role: 'system',
          content: 'DO NOT explain the dashboard, only answer with a valid JSON',
        },
        {
          role: 'user',
          content: description,
        },
      ],
    })
    .then((response: any) => response.choices[0].message.content)
    .then((content: string) => {
      const parsedJSON = JSON.parse(content);
      // Sometimes the AI returns a dashboard object, sometimes an object with the dashboard as property
      const generatedDashboard = parsedJSON?.dashboard || parsedJSON;

      return new DashboardModel(generatedDashboard);
    })
    .then(normalizeDashboard);
}

export function onCreateNewWidgetPanel(dashboard: DashboardModel, widgetType: string): number | undefined {
  const newPanel: Partial<PanelModel> = {
    type: widgetType,
    title: 'Widget title',
    gridPos: calculateNewPanelGridPos(dashboard),
    datasource: null,
    isNew: true,
  };

  dashboard.addPanel(newPanel);
  return newPanel.id;
}

export function onCreateNewRow(dashboard: DashboardModel) {
  const newRow = {
    type: 'row',
    title: 'Row title',
    gridPos: { x: 0, y: 0 },
  };

  dashboard.addPanel(newRow);
}

export function onAddLibraryPanel(dashboard: DashboardModel) {
  const newPanel = {
    type: 'add-library-panel',
    gridPos: calculateNewPanelGridPos(dashboard),
  };

  dashboard.addPanel(newPanel);
}

type PanelPluginInfo = { defaults: { gridPos: { w: number; h: number }; title: string } };

export function onPasteCopiedPanel(dashboard: DashboardModel, panelPluginInfo?: PanelPluginMeta & PanelPluginInfo) {
  if (!panelPluginInfo) {
    return;
  }

  const gridPos = calculateNewPanelGridPos(dashboard);

  const newPanel = {
    type: panelPluginInfo.id,
    title: 'Panel Title',
    gridPos: {
      x: gridPos.x,
      y: gridPos.y,
      w: panelPluginInfo.defaults.gridPos.w,
      h: panelPluginInfo.defaults.gridPos.h,
    },
  };

  // apply panel template / defaults
  if (panelPluginInfo.defaults) {
    defaults(newPanel, panelPluginInfo.defaults);
    newPanel.title = panelPluginInfo.defaults.title;
    store.delete(LS_PANEL_COPY_KEY);
  }

  dashboard.addPanel(newPanel);
}

export function getCopiedPanelPlugin(): (PanelPluginMeta & PanelPluginInfo) | undefined {
  const panels = chain(config.panels)
    .filter({ hideFromList: false })
    .map((item) => item)
    .value();

  const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
  if (copiedPanelJson) {
    const copiedPanel = JSON.parse(copiedPanelJson);

    const pluginInfo = find(panels, { id: copiedPanel.type });
    if (pluginInfo) {
      const pluginCopy: PanelPluginMeta = cloneDeep(pluginInfo);
      pluginCopy.name = copiedPanel.title;
      pluginCopy.sort = -1;

      return { ...pluginCopy, defaults: { ...copiedPanel } };
    }
  }

  return undefined;
}

/**
 * Standardize dashboard since the AI can generate old versions of the dashboard that are not  100% compatible with the latest version:
 * - Fix panels size
 */
export function normalizeDashboard(dashboard: DashboardModel): Dashboard {
  // Migrate Dashboard to the latest version
  const newDashboard = dashboard.getSaveModelClone() as Dashboard;

  // Fix panels size
  const newPanels = (newDashboard.panels || []).map((panel) => {
    console.log(panel);

    const newPanel = {
      ...panel,
      gridPos: {
        //@ts-ignore
        ...panel.gridPos,
        //@ts-ignore
        w: (panel?.gridPos?.w ?? 12) * 2,
        //@ts-ignore
        h: panel?.gridPos?.h ?? 8,
      },
    };
    console.log('normalized', newPanel);
    return newPanel;
  });

  return {
    ...newDashboard,
    panels: newPanels,
  };
}
