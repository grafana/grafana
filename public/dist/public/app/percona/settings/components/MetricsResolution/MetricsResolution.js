import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { MAX_DAYS, MIN_DAYS } from '../Advanced/Advanced.constants';
import { defaultResolutions, resolutionsOptions } from './MetricsResolution.constants';
import { getStyles } from './MetricsResolution.styles';
import { MetricsResolutionIntervals, MetricsResolutionPresets } from './MetricsResolution.types';
import { addUnits, getResolutionValue, removeUnits } from './MetricsResolution.utils';
export const MetricsResolution = () => {
    const styles = useStyles2(getStyles);
    const settingsStyles = useStyles2(getSettingsStyles);
    const [initialValues, setInitialValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const { result: settings } = useSelector(getPerconaSettings);
    const dispatch = useAppDispatch();
    const { metricsResolutions } = settings;
    const [resolution, setResolution] = useState(getResolutionValue(metricsResolutions).value);
    const [fieldsResolutions, updateFieldsResolutions] = useState(removeUnits(metricsResolutions));
    const [customResolutions, updateCustomResolutions] = useState(fieldsResolutions);
    const navModel = usePerconaNavModel('settings-metrics-resolution');
    useEffect(() => {
        setInitialValues(Object.assign(Object.assign({}, removeUnits(metricsResolutions)), { resolutions: getResolutionValue(metricsResolutions).value }));
    }, [metricsResolutions]);
    const { metrics: { action, label, link, tooltip, intervals: { low, medium, high }, }, tooltipLinkText, } = Messages;
    const resolutionValidators = [validators.required, validators.range(MIN_DAYS, MAX_DAYS)];
    const applyChanges = (values) => __awaiter(void 0, void 0, void 0, function* () {
        setLoading(true);
        yield dispatch(updateSettingsAction({
            body: { metrics_resolutions: addUnits(values) },
            token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        }));
        setLoading(false);
    });
    const updateResolutions = (form) => {
        const { hr, mr, lr, resolutions: newResolution } = form.getState().values;
        if (resolution === newResolution) {
            return;
        }
        if (resolution === MetricsResolutionPresets.custom) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            updateCustomResolutions({ hr, mr, lr });
        }
        if (newResolution !== MetricsResolutionPresets.custom) {
            const newResolutionKey = resolutionsOptions.findIndex((r) => r.value === newResolution);
            const resolutions = removeUnits(defaultResolutions[newResolutionKey]);
            updateFieldsResolutions(resolutions);
            form.change(MetricsResolutionIntervals.lr, resolutions.lr);
            form.change(MetricsResolutionIntervals.mr, resolutions.mr);
            form.change(MetricsResolutionIntervals.hr, resolutions.hr);
        }
        else {
            updateFieldsResolutions(customResolutions);
            form.change(MetricsResolutionIntervals.lr, customResolutions.lr);
            form.change(MetricsResolutionIntervals.mr, customResolutions.mr);
            form.change(MetricsResolutionIntervals.hr, customResolutions.hr);
        }
        setResolution(newResolution);
    };
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: styles.resolutionsWrapper },
                    React.createElement(Form, { onSubmit: applyChanges, initialValues: initialValues, render: ({ form, handleSubmit, valid, pristine }) => (React.createElement("form", { onSubmit: handleSubmit, 
                            // @ts-ignore
                            onChange: () => updateResolutions(form), "data-testid": "metrics-resolution-form" },
                            React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "metrics-resolution-label" },
                                React.createElement("span", null, label),
                                React.createElement(LinkTooltip, { tooltipContent: tooltip, link: link, linkText: tooltipLinkText, icon: "info-circle" })),
                            React.createElement(RadioButtonGroupField, { name: "resolutions", "data-testid": "metrics-resolution-radio-button-group", options: resolutionsOptions }),
                            React.createElement("div", { className: styles.numericFieldWrapper },
                                React.createElement(NumberInputField, { label: low, name: MetricsResolutionIntervals.lr, disabled: resolution !== MetricsResolutionPresets.custom, "data-testid": "metrics-resolution-lr-input", validators: resolutionValidators })),
                            React.createElement("div", { className: styles.numericFieldWrapper },
                                React.createElement(NumberInputField, { label: medium, name: MetricsResolutionIntervals.mr, disabled: resolution !== MetricsResolutionPresets.custom, "data-testid": "metrics-resolution-mr-input", validators: resolutionValidators })),
                            React.createElement("div", { className: styles.numericFieldWrapper },
                                React.createElement(NumberInputField, { label: high, name: MetricsResolutionIntervals.hr, disabled: resolution !== MetricsResolutionPresets.custom, "data-testid": "metrics-resolution-hr-input", validators: resolutionValidators })),
                            React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: !valid || pristine || loading, "data-testid": "metrics-resolution-button" },
                                loading && React.createElement(Spinner, null),
                                action))) }))))));
};
export default MetricsResolution;
//# sourceMappingURL=MetricsResolution.js.map