import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
const GrafanaReceiversExportPreview = ({ decrypt, exportFormat, onClose }) => {
    const { currentData: receiverDefinition = '', isFetching } = alertRuleApi.useExportReceiversQuery({
        decrypt: decrypt,
        format: exportFormat,
    });
    const downloadFileName = `contact-points-${new Date().getTime()}`;
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: receiverDefinition, downloadFileName: downloadFileName, onClose: onClose }));
};
export const GrafanaReceiversExporter = ({ onClose, decrypt }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaReceiversExportPreview, { decrypt: decrypt, exportFormat: activeTab, onClose: onClose })));
};
//# sourceMappingURL=GrafanaReceiversExporter.js.map