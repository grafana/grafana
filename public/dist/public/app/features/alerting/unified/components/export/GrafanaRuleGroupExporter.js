import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
export function GrafanaRuleGroupExporter({ folderUid, groupName, onClose }) {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { title: `Export ${groupName} rules`, activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaRuleGroupExportPreview, { folderUid: folderUid, groupName: groupName, exportFormat: activeTab, onClose: onClose })));
}
function GrafanaRuleGroupExportPreview({ folderUid, groupName, exportFormat, onClose, }) {
    const { currentData: ruleGroupTextDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
        folderUid,
        group: groupName,
        format: exportFormat,
    });
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: ruleGroupTextDefinition, downloadFileName: groupName, onClose: onClose }));
}
//# sourceMappingURL=GrafanaRuleGroupExporter.js.map