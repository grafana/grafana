import { __read } from "tslib";
import { LoadingPlaceholder } from '@grafana/ui';
import React, { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { fetchGrafanaNotifiersAction, testReceiversAction, updateAlertManagerConfigAction, } from '../../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { formChannelValuesToGrafanaChannelConfig, formValuesToGrafanaReceiver, grafanaReceiverToFormValues, updateConfigWithReceiver, } from '../../../utils/receiver-form';
import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
var defaultChannelValues = Object.freeze({
    __id: '',
    secureSettings: {},
    settings: {},
    secureFields: {},
    disableResolveMessage: false,
    type: 'email',
});
export var GrafanaReceiverForm = function (_a) {
    var existing = _a.existing, alertManagerSourceName = _a.alertManagerSourceName, config = _a.config;
    var grafanaNotifiers = useUnifiedAlertingSelector(function (state) { return state.grafanaNotifiers; });
    var dispatch = useDispatch();
    useEffect(function () {
        if (!(grafanaNotifiers.result || grafanaNotifiers.loading)) {
            dispatch(fetchGrafanaNotifiersAction());
        }
    }, [grafanaNotifiers, dispatch]);
    // transform receiver DTO to form values
    var _b = __read(useMemo(function () {
        if (!existing || !grafanaNotifiers.result) {
            return [undefined, {}];
        }
        return grafanaReceiverToFormValues(existing, grafanaNotifiers.result);
    }, [existing, grafanaNotifiers.result]), 2), existingValue = _b[0], id2original = _b[1];
    var onSubmit = function (values) {
        var newReceiver = formValuesToGrafanaReceiver(values, id2original, defaultChannelValues);
        dispatch(updateAlertManagerConfigAction({
            newConfig: updateConfigWithReceiver(config, newReceiver, existing === null || existing === void 0 ? void 0 : existing.name),
            oldConfig: config,
            alertManagerSourceName: GRAFANA_RULES_SOURCE_NAME,
            successMessage: existing ? 'Contact point updated.' : 'Contact point created',
            redirectPath: '/alerting/notifications',
        }));
    };
    var onTestChannel = function (values) {
        var existing = id2original[values.__id];
        var chan = formChannelValuesToGrafanaChannelConfig(values, defaultChannelValues, 'test', existing);
        dispatch(testReceiversAction({
            alertManagerSourceName: alertManagerSourceName,
            receivers: [
                {
                    name: 'test',
                    grafana_managed_receiver_configs: [chan],
                },
            ],
        }));
    };
    var takenReceiverNames = useMemo(function () { var _a, _b; return (_b = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.map(function (_a) {
        var name = _a.name;
        return name;
    }).filter(function (name) { return name !== (existing === null || existing === void 0 ? void 0 : existing.name); })) !== null && _b !== void 0 ? _b : []; }, [config, existing]);
    if (grafanaNotifiers.result) {
        return (React.createElement(ReceiverForm, { config: config, onSubmit: onSubmit, initialValues: existingValue, onTestChannel: onTestChannel, notifiers: grafanaNotifiers.result, alertManagerSourceName: alertManagerSourceName, defaultItem: defaultChannelValues, takenReceiverNames: takenReceiverNames, commonSettingsComponent: GrafanaCommonChannelSettings }));
    }
    else {
        return React.createElement(LoadingPlaceholder, { text: "Loading notifiers..." });
    }
};
//# sourceMappingURL=GrafanaReceiverForm.js.map