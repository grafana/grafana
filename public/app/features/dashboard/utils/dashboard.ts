import { chain, cloneDeep, defaults, find } from 'lodash';
import { Observable, of } from 'rxjs';

import { PanelPluginMeta } from '@grafana/data';
import { llms } from '@grafana/experimental';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { calculateNewPanelGridPos } from 'app/features/dashboard/utils/panel';

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

export function onGenerateDashboardWithAI(dashboard: DashboardModel, description: string): Observable<string> {
  return llms.openai
    .streamChatCompletions({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an API that only repond with JSON',
        },
        {
          role: 'system',
          content: 'Your goal is to generate a valid Grafana dashboard JSON with the provided requirements',
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
    .pipe(
      // Accumulate the stream content into a stream of strings, where each
      // element contains the accumulated message so far.
      llms.openai.accumulateContent()
    );
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
