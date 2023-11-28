import React, { useState } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from '../../api/alertRuleApi';
import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { allGrafanaExportProviders } from './providers';
const GrafanaRuleExportPreview = ({ alertUid, exportFormat, onClose }) => {
    const { currentData: ruleTextDefinition = '', isFetching } = alertRuleApi.endpoints.exportRules.useQuery({
        ruleUid: alertUid,
        format: exportFormat,
    });
    const downloadFileName = `${alertUid}-${new Date().getTime()}`;
    if (isFetching) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: ruleTextDefinition, downloadFileName: downloadFileName, onClose: onClose }));
};
export const GrafanaRuleExporter = ({ onClose, alertUid }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaRuleExportPreview, { alertUid: alertUid, exportFormat: activeTab, onClose: onClose })));
};
//# sourceMappingURL=GrafanaRuleExporter.js.map