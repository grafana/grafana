import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
export function GrafanaRuleFolderExporter({ folder, onClose }) {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { title: `Export ${folder.title} rules`, activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaRuleFolderExportPreview, { folder: folder, exportFormat: activeTab, onClose: onClose })));
}
function GrafanaRuleFolderExportPreview({ folder, exportFormat, onClose }) {
    const { currentData: exportFolderDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
        folderUid: folder.uid,
        format: exportFormat,
    });
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    const downloadFileName = `${folder.title}-${folder.uid}`;
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: exportFolderDefinition, downloadFileName: downloadFileName, onClose: onClose }));
}
//# sourceMappingURL=GrafanaRuleFolderExporter.js.map