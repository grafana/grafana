import React from 'react';
import { Alert } from '@grafana/ui';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { TemplatesTable } from '../receivers/TemplatesTable';
export const MessageTemplates = () => {
    const { selectedAlertmanager } = useAlertmanager();
    const { data, error } = useAlertmanagerConfig(selectedAlertmanager);
    if (error) {
        return React.createElement(Alert, { title: "Failed to fetch message templates" }, String(error));
    }
    if (data) {
        return React.createElement(TemplatesTable, { config: data, alertManagerName: selectedAlertmanager });
    }
    return null;
};
//# sourceMappingURL=MessageTemplates.js.map