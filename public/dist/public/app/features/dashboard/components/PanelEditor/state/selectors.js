import memoizeOne from 'memoize-one';
import { PanelEditorTabId } from '../types';
import { getConfig } from 'app/core/config';
export var getPanelEditorTabs = memoizeOne(function (tab, plugin) {
    var _a;
    var tabs = [];
    if (!plugin) {
        return tabs;
    }
    var defaultTab = PanelEditorTabId.Visualize;
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
    if (((getConfig().alertingEnabled || getConfig().unifiedAlertingEnabled) && plugin.meta.id === 'graph') ||
        plugin.meta.id === 'timeseries') {
        tabs.push({
            id: PanelEditorTabId.Alert,
            text: 'Alert',
            icon: 'bell',
            active: false,
        });
    }
    var activeTab = (_a = tabs.find(function (item) { return item.id === (tab || defaultTab); })) !== null && _a !== void 0 ? _a : tabs[0];
    activeTab.active = true;
    return tabs;
});
//# sourceMappingURL=selectors.js.map