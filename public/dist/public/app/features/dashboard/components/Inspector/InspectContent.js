import { isEmpty } from 'lodash';
import React, { useState } from 'react';
import { CoreApp, formattedValueToString, getValueFormat, LoadingState, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectMetadataTab } from 'app/features/inspector/InspectMetadataTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectTab } from 'app/features/inspector/types';
export const InspectContent = ({ panel, plugin, dashboard, tabs, data, isDataLoading, dataOptions, metadataDatasource, defaultTab, onDataOptionsChange, onClose, }) => {
    var _a;
    const [currentTab, setCurrentTab] = useState(defaultTab !== null && defaultTab !== void 0 ? defaultTab : InspectTab.Data);
    if (!plugin) {
        return null;
    }
    let errors = getErrors(data);
    // Validate that the active tab is actually valid and allowed
    let activeTab = currentTab;
    if (!tabs.find((item) => item.value === currentTab)) {
        activeTab = InspectTab.JSON;
    }
    const panelTitle = getTemplateSrv().replace(panel.title, panel.scopedVars, 'text') || 'Panel';
    const title = t('dashboard.inspect.title', 'Inspect: {{panelTitle}}', { panelTitle });
    return (React.createElement(Drawer, { title: title, subtitle: data && formatStats(data), onClose: onClose, tabs: React.createElement(TabsBar, null, tabs.map((tab, index) => {
            return (React.createElement(Tab, { key: `${tab.value}-${index}`, label: tab.label, active: tab.value === activeTab, onChangeTab: () => setCurrentTab(tab.value || InspectTab.Data) }));
        })) },
        activeTab === InspectTab.Data && (React.createElement(InspectDataTab, { dataName: panel.getDisplayTitle(), panelPluginId: panel.type, fieldConfig: panel.fieldConfig, hasTransformations: Boolean((_a = panel.transformations) === null || _a === void 0 ? void 0 : _a.length), data: data && data.series, isLoading: isDataLoading, options: dataOptions, onOptionsChange: onDataOptionsChange, timeZone: dashboard.timezone, app: CoreApp.Dashboard })),
        data && activeTab === InspectTab.Meta && (React.createElement(InspectMetadataTab, { data: data, metadataDatasource: metadataDatasource })),
        activeTab === InspectTab.JSON && (React.createElement(InspectJSONTab, { panel: panel, dashboard: dashboard, data: data, onClose: onClose })),
        activeTab === InspectTab.Error && React.createElement(InspectErrorTab, { errors: errors }),
        data && activeTab === InspectTab.Stats && React.createElement(InspectStatsTab, { data: data, timeZone: dashboard.getTimezone() }),
        data && activeTab === InspectTab.Query && React.createElement(QueryInspector, { data: data, onRefreshQuery: () => panel.refresh() })));
};
// This will combine
function getErrors(data) {
    var _a;
    let errors = (_a = data === null || data === void 0 ? void 0 : data.errors) !== null && _a !== void 0 ? _a : [];
    if ((data === null || data === void 0 ? void 0 : data.error) && !errors.includes(data.error)) {
        errors = [data.error, ...errors];
    }
    if (!errors.length && (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Error) {
        return [
            {
                message: 'Error loading data',
            },
        ];
    }
    return errors;
}
function formatStats(data) {
    const { request } = data;
    if (!request || isEmpty(request)) {
        return '';
    }
    const queryCount = request.targets.length;
    const requestTime = request.endTime ? request.endTime - request.startTime : 0;
    const formatted = formattedValueToString(getValueFormat('ms')(requestTime));
    return (React.createElement(Trans, { i18nKey: "dashboard.inspect.subtitle" },
        { queryCount },
        " queries with total query time of ",
        { formatted }));
}
//# sourceMappingURL=InspectContent.js.map