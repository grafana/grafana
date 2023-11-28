import React from 'react';
import { Alert } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';
export const EditReceiverView = ({ config, receiverName, alertManagerSourceName }) => {
    var _a;
    const receiver = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.find(({ name }) => name === receiverName);
    if (!receiver) {
        return (React.createElement(Alert, { severity: "error", title: "Receiver not found" }, "Sorry, this receiver does not seem to exist."));
    }
    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return React.createElement(GrafanaReceiverForm, { config: config, alertManagerSourceName: alertManagerSourceName, existing: receiver });
    }
    else {
        return React.createElement(CloudReceiverForm, { config: config, alertManagerSourceName: alertManagerSourceName, existing: receiver });
    }
};
//# sourceMappingURL=EditReceiverView.js.map