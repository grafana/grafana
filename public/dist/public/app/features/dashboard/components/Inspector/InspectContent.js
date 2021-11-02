import { __read } from "tslib";
import React, { useState } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { CustomScrollbar, Drawer, TabContent } from '@grafana/ui';
import { getPanelInspectorStyles } from 'app/features/inspector/styles';
import { InspectMetadataTab } from 'app/features/inspector/InspectMetadataTab';
import { InspectSubtitle } from 'app/features/inspector/InspectSubtitle';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectTab } from 'app/features/inspector/types';
import { InspectActionsTab } from './PanelInspectActions';
export var InspectContent = function (_a) {
    var panel = _a.panel, plugin = _a.plugin, dashboard = _a.dashboard, tabs = _a.tabs, data = _a.data, isDataLoading = _a.isDataLoading, dataOptions = _a.dataOptions, metadataDatasource = _a.metadataDatasource, defaultTab = _a.defaultTab, onDataOptionsChange = _a.onDataOptionsChange, onClose = _a.onClose;
    var _b = __read(useState(defaultTab !== null && defaultTab !== void 0 ? defaultTab : InspectTab.Data), 2), currentTab = _b[0], setCurrentTab = _b[1];
    if (!plugin) {
        return null;
    }
    var styles = getPanelInspectorStyles();
    var error = data === null || data === void 0 ? void 0 : data.error;
    // Validate that the active tab is actually valid and allowed
    var activeTab = currentTab;
    if (!tabs.find(function (item) { return item.value === currentTab; })) {
        activeTab = InspectTab.JSON;
    }
    var title = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text');
    return (React.createElement(Drawer, { title: "Inspect: " + (title || 'Panel'), subtitle: React.createElement(InspectSubtitle, { tabs: tabs, tab: activeTab, data: data, onSelectTab: function (item) { return setCurrentTab(item.value || InspectTab.Data); } }), width: "50%", onClose: onClose, expandable: true },
        activeTab === InspectTab.Data && (React.createElement(InspectDataTab, { panel: panel, data: data && data.series, isLoading: isDataLoading, options: dataOptions, onOptionsChange: onDataOptionsChange })),
        React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            React.createElement(TabContent, { className: styles.tabContent },
                data && activeTab === InspectTab.Meta && (React.createElement(InspectMetadataTab, { data: data, metadataDatasource: metadataDatasource })),
                activeTab === InspectTab.JSON && (React.createElement(InspectJSONTab, { panel: panel, dashboard: dashboard, data: data, onClose: onClose })),
                activeTab === InspectTab.Error && React.createElement(InspectErrorTab, { error: error }),
                data && activeTab === InspectTab.Stats && React.createElement(InspectStatsTab, { data: data, timeZone: dashboard.getTimezone() }),
                data && activeTab === InspectTab.Query && (React.createElement(QueryInspector, { panel: panel, data: data.series, onRefreshQuery: function () { return panel.refresh(); } })),
                activeTab === InspectTab.Actions && React.createElement(InspectActionsTab, { panel: panel, data: data })))));
};
//# sourceMappingURL=InspectContent.js.map