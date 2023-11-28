import React from 'react';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditTemplateView } from '../receivers/EditTemplateView';
const EditMessageTemplate = ({ match }) => {
    const { selectedAlertmanager } = useAlertmanager();
    const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);
    const name = match === null || match === void 0 ? void 0 : match.params.name;
    if (!name) {
        return React.createElement(EntityNotFound, { entity: "Message template" });
    }
    if (isLoading && !data) {
        return 'loading...';
    }
    if (error) {
        return (React.createElement(Alert, { severity: "error", title: "Failed to fetch message template" }, String(error)));
    }
    if (!data) {
        return null;
    }
    return (React.createElement(EditTemplateView, { alertManagerSourceName: selectedAlertmanager, config: data, templateName: decodeURIComponent(name) }));
};
export default EditMessageTemplate;
//# sourceMappingURL=EditMessageTemplate.js.map