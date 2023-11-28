import React from 'react';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditReceiverView } from '../receivers/EditReceiverView';
const EditContactPoint = ({ match }) => {
    const { selectedAlertmanager } = useAlertmanager();
    const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);
    const contactPointName = match === null || match === void 0 ? void 0 : match.params.name;
    if (!contactPointName) {
        return React.createElement(EntityNotFound, { entity: "Contact point" });
    }
    if (isLoading && !data) {
        return 'loading...';
    }
    if (error) {
        return (React.createElement(Alert, { severity: "error", title: "Failed to fetch contact point" }, String(error)));
    }
    if (!data) {
        return null;
    }
    return (React.createElement(EditReceiverView, { alertManagerSourceName: selectedAlertmanager, config: data, receiverName: decodeURIComponent(contactPointName) }));
};
export default EditContactPoint;
//# sourceMappingURL=EditContactPoint.js.map