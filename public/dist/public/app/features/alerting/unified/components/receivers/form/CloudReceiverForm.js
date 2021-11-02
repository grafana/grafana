import { __read } from "tslib";
import { Alert } from '@grafana/ui';
import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { updateAlertManagerConfigAction } from '../../../state/actions';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { makeAMLink } from '../../../utils/misc';
import { cloudReceiverToFormValues, formValuesToCloudReceiver, updateConfigWithReceiver, } from '../../../utils/receiver-form';
import { CloudCommonChannelSettings } from './CloudCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
var defaultChannelValues = Object.freeze({
    __id: '',
    sendResolved: true,
    secureSettings: {},
    settings: {},
    secureFields: {},
    type: 'email',
});
export var CloudReceiverForm = function (_a) {
    var existing = _a.existing, alertManagerSourceName = _a.alertManagerSourceName, config = _a.config;
    var dispatch = useDispatch();
    var isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    // transform receiver DTO to form values
    var _b = __read(useMemo(function () {
        if (!existing) {
            return [undefined, {}];
        }
        return cloudReceiverToFormValues(existing, cloudNotifierTypes);
    }, [existing]), 1), existingValue = _b[0];
    var onSubmit = function (values) {
        var newReceiver = formValuesToCloudReceiver(values, defaultChannelValues);
        dispatch(updateAlertManagerConfigAction({
            newConfig: updateConfigWithReceiver(config, newReceiver, existing === null || existing === void 0 ? void 0 : existing.name),
            oldConfig: config,
            alertManagerSourceName: alertManagerSourceName,
            successMessage: existing ? 'Contact point updated.' : 'Contact point created.',
            redirectPath: makeAMLink('/alerting/notifications', alertManagerSourceName),
        }));
    };
    var takenReceiverNames = useMemo(function () { var _a, _b; return (_b = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.map(function (_a) {
        var name = _a.name;
        return name;
    }).filter(function (name) { return name !== (existing === null || existing === void 0 ? void 0 : existing.name); })) !== null && _b !== void 0 ? _b : []; }, [config, existing]);
    return (React.createElement(React.Fragment, null,
        !isVanillaAM && (React.createElement(Alert, { title: "Info", severity: "info" }, "Note that empty string values will be replaced with global defaults were appropriate.")),
        React.createElement(ReceiverForm, { config: config, onSubmit: onSubmit, initialValues: existingValue, notifiers: cloudNotifierTypes, alertManagerSourceName: alertManagerSourceName, defaultItem: defaultChannelValues, takenReceiverNames: takenReceiverNames, commonSettingsComponent: CloudCommonChannelSettings })));
};
//# sourceMappingURL=CloudReceiverForm.js.map