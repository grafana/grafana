import React from 'react';
import { Alert } from '@grafana/ui';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewReceiverView } from '../receivers/NewReceiverView';
const NewContactPoint = (_props) => {
    const { selectedAlertmanager } = useAlertmanager();
    const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);
    if (isLoading && !data) {
        return 'loading...';
    }
    if (error) {
        return (React.createElement(Alert, { severity: "error", title: "Failed to fetch contact point" }, String(error)));
    }
    if (!data) {
        return null;
    }
    return React.createElement(NewReceiverView, { config: data, alertManagerSourceName: selectedAlertmanager });
};
export default NewContactPoint;
//# sourceMappingURL=NewContactPoint.js.map