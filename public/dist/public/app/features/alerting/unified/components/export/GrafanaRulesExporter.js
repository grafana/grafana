import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
export function GrafanaRulesExporter({ onClose }) {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaRulesExportPreview, { exportFormat: activeTab, onClose: onClose })));
}
function GrafanaRulesExportPreview({ exportFormat, onClose }) {
    const { currentData: rulesDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
        format: exportFormat,
    });
    const downloadFileName = `alert-rules-${new Date().getTime()}`;
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: rulesDefinition, downloadFileName: downloadFileName, onClose: onClose }));
}
//# sourceMappingURL=GrafanaRulesExporter.js.map