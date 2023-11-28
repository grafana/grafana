import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
const GrafanaPoliciesExporterPreview = ({ exportFormat, onClose }) => {
    const { currentData: policiesDefinition = '', isFetching } = alertRuleApi.useExportPoliciesQuery({
        format: exportFormat,
    });
    const downloadFileName = `policies-${new Date().getTime()}`;
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: policiesDefinition, downloadFileName: downloadFileName, onClose: onClose }));
};
export const GrafanaPoliciesExporter = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaPoliciesExporterPreview, { exportFormat: activeTab, onClose: onClose })));
};
//# sourceMappingURL=GrafanaPoliciesExporter.js.map