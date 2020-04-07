import memoizeOne from 'memoize-one';
import { LocationState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { PanelEditorTab, PanelEditorTabId } from '../types';

export const getPanelEditorTabs = memoizeOne((location: LocationState, plugin?: PanelPlugin) => {
  const tabs: PanelEditorTab[] = [];

  if (!plugin) {
    return tabs;
  }

  let defaultTab = PanelEditorTabId.Visualize;

  if (!plugin.meta.skipDataQuery) {
    defaultTab = PanelEditorTabId.Query;

    tabs.push({
      id: PanelEditorTabId.Query,
      text: 'Query',
      icon: 'gicon gicon-datasources',
      active: false,
    });

    tabs.push({
      id: PanelEditorTabId.Transform,
      text: 'Transform',
      icon: 'fa fa-exchange',
      active: false,
    });
  }

  tabs.push({
    id: PanelEditorTabId.Visualize,
    text: 'Visualize',
    icon: 'fa fa-bar-chart',
    active: false,
  });

  if (plugin.meta.id === 'graph') {
    tabs.push({
      id: PanelEditorTabId.Alert,
      text: 'Alert',
      icon: 'gicon gicon-alert',
      active: false,
    });
  }

  const activeTab = tabs.find(item => item.id === (location.query.tab || defaultTab));
  activeTab.active = true;

  return tabs;
});
