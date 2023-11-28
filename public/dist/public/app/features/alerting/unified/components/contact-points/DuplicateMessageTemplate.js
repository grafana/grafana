import React from 'react';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { DuplicateTemplateView } from '../receivers/DuplicateTemplateView';
const NewMessageTemplate = ({ match }) => {
    const { selectedAlertmanager } = useAlertmanager();
    const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);
    const name = match === null || match === void 0 ? void 0 : match.params.name;
    if (!name) {
        return React.createElement(EntityNotFound, { entity: "Message template" });
    }
    if (isLoading && !data) {
        return 'loading...';
    }
    // TODO decent error handling
    if (error) {
        return String(error);
    }
    if (!data) {
        return null;
    }
    return React.createElement(DuplicateTemplateView, { alertManagerSourceName: selectedAlertmanager, config: data, templateName: name });
};
export default NewMessageTemplate;
//# sourceMappingURL=DuplicateMessageTemplate.js.map