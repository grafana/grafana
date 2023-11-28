import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
const GrafanaReceiverExportPreview = ({ receiverName, decrypt, exportFormat, onClose, }) => {
    const { currentData: receiverDefinition = '', isFetching } = alertRuleApi.useExportReceiverQuery({
        receiverName: receiverName,
        decrypt: decrypt,
        format: exportFormat,
    });
    const downloadFileName = `cp-${receiverName}-${new Date().getTime()}`;
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: receiverDefinition, downloadFileName: downloadFileName, onClose: onClose }));
};
export const GrafanaReceiverExporter = ({ onClose, receiverName, decrypt }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaReceiverExportPreview, { receiverName: receiverName, decrypt: decrypt, exportFormat: activeTab, onClose: onClose })));
};
//# sourceMappingURL=GrafanaReceiverExporter.js.map