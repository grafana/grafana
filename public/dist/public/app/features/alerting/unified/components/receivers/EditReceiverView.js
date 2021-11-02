import { InfoBox } from '@grafana/ui';
import React from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';
export var EditReceiverView = function (_a) {
    var _b;
    var config = _a.config, receiverName = _a.receiverName, alertManagerSourceName = _a.alertManagerSourceName;
    var receiver = (_b = config.alertmanager_config.receivers) === null || _b === void 0 ? void 0 : _b.find(function (_a) {
        var name = _a.name;
        return name === receiverName;
    });
    if (!receiver) {
        return (React.createElement(InfoBox, { severity: "error", title: "Receiver not found" }, "Sorry, this receiver does not seem to exit."));
    }
    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return React.createElement(GrafanaReceiverForm, { config: config, alertManagerSourceName: alertManagerSourceName, existing: receiver });
    }
    else {
        return React.createElement(CloudReceiverForm, { config: config, alertManagerSourceName: alertManagerSourceName, existing: receiver });
    }
};
//# sourceMappingURL=EditReceiverView.js.map