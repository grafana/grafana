import { __awaiter } from "tslib";
import React, { useMemo, useState } from 'react';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { testReceiversAction, updateAlertManagerConfigAction } from '../../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { formChannelValuesToGrafanaChannelConfig, formValuesToGrafanaReceiver, grafanaReceiverToFormValues, updateConfigWithReceiver, } from '../../../utils/receiver-form';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { ReceiverTypes } from '../grafanaAppReceivers/onCall/onCall';
import { useOnCallIntegration } from '../grafanaAppReceivers/onCall/useOnCallIntegration';
import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
import { TestContactPointModal } from './TestContactPointModal';
const defaultChannelValues = Object.freeze({
    __id: '',
    secureSettings: {},
    settings: {},
    secureFields: {},
    disableResolveMessage: false,
    type: 'email',
});
export const GrafanaReceiverForm = ({ existing, alertManagerSourceName, config }) => {
    var _a;
    const dispatch = useDispatch();
    const { onCallNotifierMeta, extendOnCallNotifierFeatures, extendOnCallReceivers, onCallFormValidators, createOnCallIntegrations, isLoadingOnCallIntegration, hasOnCallError, } = useOnCallIntegration();
    const { useGrafanaNotifiersQuery } = alertmanagerApi;
    const { data: grafanaNotifiers = [], isLoading: isLoadingNotifiers } = useGrafanaNotifiersQuery();
    const [testChannelValues, setTestChannelValues] = useState();
    // transform receiver DTO to form values
    const [existingValue, id2original] = useMemo(() => {
        if (!existing || isLoadingNotifiers || isLoadingOnCallIntegration) {
            return [undefined, {}];
        }
        return grafanaReceiverToFormValues(extendOnCallReceivers(existing), grafanaNotifiers);
    }, [existing, isLoadingNotifiers, grafanaNotifiers, extendOnCallReceivers, isLoadingOnCallIntegration]);
    const onSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        const newReceiver = formValuesToGrafanaReceiver(values, id2original, defaultChannelValues, grafanaNotifiers);
        const receiverWithOnCall = yield createOnCallIntegrations(newReceiver);
        const newConfig = updateConfigWithReceiver(config, receiverWithOnCall, existing === null || existing === void 0 ? void 0 : existing.name);
        yield dispatch(updateAlertManagerConfigAction({
            newConfig: newConfig,
            oldConfig: config,
            alertManagerSourceName: GRAFANA_RULES_SOURCE_NAME,
            successMessage: existing ? 'Contact point updated.' : 'Contact point created',
            redirectPath: '/alerting/notifications',
        })).then(() => {
            dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
        });
    });
    const onTestChannel = (values) => {
        setTestChannelValues(values);
    };
    const testNotification = (alert) => {
        if (testChannelValues) {
            const existing = id2original[testChannelValues.__id];
            const chan = formChannelValuesToGrafanaChannelConfig(testChannelValues, defaultChannelValues, 'test', existing);
            const payload = {
                alertManagerSourceName,
                receivers: [
                    {
                        name: 'test',
                        grafana_managed_receiver_configs: [chan],
                    },
                ],
                alert,
            };
            dispatch(testReceiversAction(payload));
        }
    };
    const takenReceiverNames = useMemo(() => { var _a, _b; return (_b = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.map(({ name }) => name).filter((name) => name !== (existing === null || existing === void 0 ? void 0 : existing.name))) !== null && _b !== void 0 ? _b : []; }, [config, existing]);
    // if any receivers in the contact point have a "provenance", the entire contact point should be readOnly
    const hasProvisionedItems = existing
        ? ((_a = existing.grafana_managed_receiver_configs) !== null && _a !== void 0 ? _a : []).some((item) => Boolean(item.provenance))
        : false;
    // this basically checks if we can manage the selected alert manager data source, either because it's a Grafana Managed one
    // or a Mimir-based AlertManager
    const isManageableAlertManagerDataSource = !isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    const isEditable = isManageableAlertManagerDataSource && !hasProvisionedItems;
    const isTestable = isManageableAlertManagerDataSource || hasProvisionedItems;
    if (isLoadingNotifiers || isLoadingOnCallIntegration) {
        return React.createElement(LoadingPlaceholder, { text: "Loading notifiers..." });
    }
    const notifiers = grafanaNotifiers.map((n) => {
        if (n.type === 'oncall') {
            return {
                dto: extendOnCallNotifierFeatures(n),
                meta: onCallNotifierMeta,
            };
        }
        return { dto: n };
    });
    return (React.createElement(React.Fragment, null,
        hasOnCallError && (React.createElement(Alert, { severity: "error", title: "Loading OnCall integration failed" }, "Grafana OnCall plugin has been enabled in your Grafana instances but it is not reachable. Please check the plugin configuration")),
        hasProvisionedItems && React.createElement(ProvisioningAlert, { resource: ProvisionedResource.ContactPoint }),
        React.createElement(ReceiverForm, { isEditable: isEditable, isTestable: isTestable, config: config, onSubmit: onSubmit, initialValues: existingValue, onTestChannel: onTestChannel, notifiers: notifiers, alertManagerSourceName: alertManagerSourceName, defaultItem: Object.assign({}, defaultChannelValues), takenReceiverNames: takenReceiverNames, commonSettingsComponent: GrafanaCommonChannelSettings, customValidators: { [ReceiverTypes.OnCall]: onCallFormValidators } }),
        React.createElement(TestContactPointModal, { onDismiss: () => setTestChannelValues(undefined), isOpen: !!testChannelValues, onTest: (alert) => testNotification(alert) })));
};
//# sourceMappingURL=GrafanaReceiverForm.js.map