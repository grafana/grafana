import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert, Button, Field, FieldSet, Input, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { renameMuteTimings } from '../../utils/alertmanager';
import { makeAMLink } from '../../utils/misc';
import { createMuteTiming, defaultTimeInterval } from '../../utils/mute-timings';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { MuteTimingTimeInterval } from './MuteTimingTimeInterval';
const useDefaultValues = (muteTiming) => {
    const defaultValues = {
        name: '',
        time_intervals: [defaultTimeInterval],
    };
    if (!muteTiming) {
        return defaultValues;
    }
    const intervals = muteTiming.time_intervals.map((interval) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            times: (_a = interval.times) !== null && _a !== void 0 ? _a : defaultTimeInterval.times,
            weekdays: (_c = (_b = interval.weekdays) === null || _b === void 0 ? void 0 : _b.join(', ')) !== null && _c !== void 0 ? _c : defaultTimeInterval.weekdays,
            days_of_month: (_e = (_d = interval.days_of_month) === null || _d === void 0 ? void 0 : _d.join(', ')) !== null && _e !== void 0 ? _e : defaultTimeInterval.days_of_month,
            months: (_g = (_f = interval.months) === null || _f === void 0 ? void 0 : _f.join(', ')) !== null && _g !== void 0 ? _g : defaultTimeInterval.months,
            years: (_j = (_h = interval.years) === null || _h === void 0 ? void 0 : _h.join(', ')) !== null && _j !== void 0 ? _j : defaultTimeInterval.years,
            location: (_k = interval.location) !== null && _k !== void 0 ? _k : defaultTimeInterval.location,
        });
    });
    return {
        name: muteTiming.name,
        time_intervals: intervals,
    };
};
const MuteTimingForm = ({ muteTiming, showError, loading, provenance }) => {
    var _a, _b;
    const dispatch = useDispatch();
    const { selectedAlertmanager } = useAlertmanager();
    const styles = useStyles2(getStyles);
    const [updating, setUpdating] = useState(false);
    const { currentData: result } = useAlertmanagerConfig(selectedAlertmanager);
    const config = result === null || result === void 0 ? void 0 : result.alertmanager_config;
    const defaultValues = useDefaultValues(muteTiming);
    const formApi = useForm({ defaultValues });
    const onSubmit = (values) => {
        var _a, _b;
        if (!result) {
            return;
        }
        const newMuteTiming = createMuteTiming(values);
        const muteTimings = muteTiming
            ? (_a = config === null || config === void 0 ? void 0 : config.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.filter(({ name }) => name !== muteTiming.name)
            : config === null || config === void 0 ? void 0 : config.mute_time_intervals;
        const newConfig = Object.assign(Object.assign({}, result), { alertmanager_config: Object.assign(Object.assign({}, config), { route: muteTiming && newMuteTiming.name !== muteTiming.name
                    ? renameMuteTimings(newMuteTiming.name, muteTiming.name, (_b = config === null || config === void 0 ? void 0 : config.route) !== null && _b !== void 0 ? _b : {})
                    : config === null || config === void 0 ? void 0 : config.route, mute_time_intervals: [...(muteTimings || []), newMuteTiming] }) });
        const saveAction = dispatch(updateAlertManagerConfigAction({
            newConfig,
            oldConfig: result,
            alertManagerSourceName: selectedAlertmanager,
            successMessage: 'Mute timing saved',
            redirectPath: '/alerting/routes/',
            redirectSearch: 'tab=mute_timings',
        }));
        setUpdating(true);
        saveAction.unwrap().finally(() => {
            setUpdating(false);
        });
    };
    return (React.createElement(React.Fragment, null,
        provenance && React.createElement(ProvisioningAlert, { resource: ProvisionedResource.MuteTiming }),
        loading && React.createElement(LoadingPlaceholder, { text: "Loading mute timing" }),
        showError && React.createElement(Alert, { title: "No matching mute timing found" }),
        result && !loading && !showError && (React.createElement(FormProvider, Object.assign({}, formApi),
            React.createElement("form", { onSubmit: formApi.handleSubmit(onSubmit), "data-testid": "mute-timing-form" },
                React.createElement(FieldSet, { label: 'Create mute timing', disabled: Boolean(provenance) || updating },
                    React.createElement(Field, { required: true, label: "Name", description: "A unique name for the mute timing", invalid: !!((_a = formApi.formState.errors) === null || _a === void 0 ? void 0 : _a.name), error: (_b = formApi.formState.errors.name) === null || _b === void 0 ? void 0 : _b.message },
                        React.createElement(Input, Object.assign({}, formApi.register('name', {
                            required: true,
                            validate: (value) => {
                                var _a;
                                if (!muteTiming) {
                                    const existingMuteTiming = (_a = config === null || config === void 0 ? void 0 : config.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.find(({ name }) => value === name);
                                    return existingMuteTiming ? `Mute timing already exists for "${value}"` : true;
                                }
                                return;
                            },
                        }), { className: styles.input, "data-testid": 'mute-timing-name' }))),
                    React.createElement(MuteTimingTimeInterval, null),
                    React.createElement(Button, { type: "submit", className: styles.submitButton, disabled: updating }, "Save mute timing"),
                    React.createElement(LinkButton, { type: "button", variant: "secondary", fill: "outline", href: makeAMLink('/alerting/routes/', selectedAlertmanager, { tab: 'mute_timings' }), disabled: updating }, "Cancel")))))));
};
const getStyles = (theme) => ({
    input: css `
    width: 400px;
  `,
    submitButton: css `
    margin-right: ${theme.spacing(1)};
  `,
});
export default MuteTimingForm;
//# sourceMappingURL=MuteTimingForm.js.map