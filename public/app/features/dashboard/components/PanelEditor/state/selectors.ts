import memoizeOne from 'memoize-one';
import { LocationState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { PanelEditorTab, PanelEditorTabId } from '../types';
import { getConfig } from 'app/core/config';

export const getPanelEditorTabs = memoizeOne((location: LocationState, plugin?: PanelPlugin) => {
  const tabs: PanelEditorTab[] = [];

  if (!plugin) {
    return tabs;
  }

  let defaultTab = PanelEditorTabId.Visualize;

  if (plugin.meta.skipDataQuery) {
    return [];
  }

  if (!plugin.meta.skipDataQuery) {
    defaultTab = PanelEditorTabId.Query;

    tabs.push({
      id: PanelEditorTabId.Query,
      text: 'Query',
      icon: 'database',
      active: false,
    });

    tabs.push({
      id: PanelEditorTabId.Transform,
      text: 'Transform',
      icon: 'process',
      active: false,
    });
  }

  if (getConfig().alertingEnabled && plugin.meta.id === 'graph') {
    tabs.push({
      id: PanelEditorTabId.Alert,
      text: 'Alert',
      icon: 'bell',
      active: false,
    });
  }

  const activeTab = tabs.find(item => item.id === (location.query.tab || defaultTab)) ?? tabs[0];
  activeTab.active = true;

  return tabs;
});
