import memoizeOne from 'memoize-one';

import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PanelModel } from 'app/features/dashboard/state';

import { PanelEditorTab, PanelEditorTabId } from '../types';

export function getPanelEditorTabs(tab?: string, panel?: PanelModel): PanelEditorTab[] {
  if (!panel?.supportsDataQuery) {
    return [];
  }
  return getPanelEditorTabsMemo(tab, panel);
}

// Only called when a query exists
const getPanelEditorTabsMemo = memoizeOne((tab?: string, panel?: PanelModel) => {
  const tabs: PanelEditorTab[] = [];
  const defaultTab = PanelEditorTabId.Query;

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

  const { alertingEnabled, unifiedAlertingEnabled } = getConfig();
  const hasRuleReadPermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).read);
  const isAlertingAvailable = alertingEnabled || (unifiedAlertingEnabled && hasRuleReadPermissions);

  const type = panel?.type;
  const isGraph = type === 'graph';
  const isTimeseries = type === 'timeseries';

  if ((isAlertingAvailable && isGraph) || isTimeseries) {
    tabs.push({
      id: PanelEditorTabId.Alert,
      text: 'Alert',
      icon: 'bell',
      active: false,
    });
  }

  const activeTab = tabs.find((item) => item.id === (tab || defaultTab)) ?? tabs[0];
  activeTab.active = true;

  return tabs;
});
