import React from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';
export var NewReceiverView = function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, config = _a.config;
    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return React.createElement(GrafanaReceiverForm, { alertManagerSourceName: alertManagerSourceName, config: config });
    }
    else {
        return React.createElement(CloudReceiverForm, { alertManagerSourceName: alertManagerSourceName, config: config });
    }
};
//# sourceMappingURL=NewReceiverView.js.map