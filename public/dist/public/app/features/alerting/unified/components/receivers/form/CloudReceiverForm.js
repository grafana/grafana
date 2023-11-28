import { __awaiter } from "tslib";
import React, { useMemo } from 'react';
import { Alert } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { updateAlertManagerConfigAction } from '../../../state/actions';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { cloudReceiverToFormValues, formValuesToCloudReceiver, updateConfigWithReceiver, } from '../../../utils/receiver-form';
import { CloudCommonChannelSettings } from './CloudCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
const defaultChannelValues = Object.freeze({
    __id: '',
    sendResolved: true,
    secureSettings: {},
    settings: {},
    secureFields: {},
    type: 'email',
});
const cloudNotifiers = cloudNotifierTypes.map((n) => ({ dto: n }));
export const CloudReceiverForm = ({ existing, alertManagerSourceName, config }) => {
    const dispatch = useDispatch();
    const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    // transform receiver DTO to form values
    const [existingValue] = useMemo(() => {
        if (!existing) {
            return [undefined, {}];
        }
        return cloudReceiverToFormValues(existing, cloudNotifierTypes);
    }, [existing]);
    const onSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        const newReceiver = formValuesToCloudReceiver(values, defaultChannelValues);
        yield dispatch(updateAlertManagerConfigAction({
            newConfig: updateConfigWithReceiver(config, newReceiver, existing === null || existing === void 0 ? void 0 : existing.name),
            oldConfig: config,
            alertManagerSourceName,
            successMessage: existing ? 'Contact point updated.' : 'Contact point created.',
            redirectPath: '/alerting/notifications',
        })).then(() => {
            dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
        });
    });
    const takenReceiverNames = useMemo(() => { var _a, _b; return (_b = (_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.map(({ name }) => name).filter((name) => name !== (existing === null || existing === void 0 ? void 0 : existing.name))) !== null && _b !== void 0 ? _b : []; }, [config, existing]);
    // this basically checks if we can manage the selected alert manager data source, either because it's a Grafana Managed one
    // or a Mimir-based AlertManager
    const isManageableAlertManagerDataSource = !isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    return (React.createElement(React.Fragment, null,
        !isVanillaAM && (React.createElement(Alert, { title: "Info", severity: "info" }, "Note that empty string values will be replaced with global defaults where appropriate.")),
        React.createElement(ReceiverForm, { isEditable: isManageableAlertManagerDataSource, isTestable: isManageableAlertManagerDataSource, config: config, onSubmit: onSubmit, initialValues: existingValue, notifiers: cloudNotifiers, alertManagerSourceName: alertManagerSourceName, defaultItem: defaultChannelValues, takenReceiverNames: takenReceiverNames, commonSettingsComponent: CloudCommonChannelSettings })));
};
//# sourceMappingURL=CloudReceiverForm.js.map