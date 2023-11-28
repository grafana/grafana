import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { Field, withTypes } from 'react-final-form';
import { Button, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import DbaasDeprecationWarning from 'app/percona/dbaas/components/DeprecationWarning';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { MAX_DAYS, MIN_DAYS, MIN_STT_CHECK_INTERVAL, SECONDS_IN_DAY, STT_CHECK_INTERVALS, STT_CHECK_INTERVAL_STEP, TECHNICAL_PREVIEW_DOC_URL, } from './Advanced.constants';
import { getStyles } from './Advanced.styles';
import { convertCheckIntervalsToHours, convertHoursStringToSeconds, convertSecondsToDays, dBaaSToggleOnChange, } from './Advanced.utils';
import { SwitchRow } from './SwitchRow';
const { advanced: { sttCheckIntervalsLabel, sttCheckIntervalTooltip, sttCheckIntervalUnit }, } = Messages;
export const Advanced = () => {
    const styles = useStyles2(getStyles);
    const [generateToken] = useCancelToken();
    const { result: settings } = useSelector(getPerconaSettings);
    const dispatch = useAppDispatch();
    const navModel = usePerconaNavModel('settings-advanced');
    const { sttCheckIntervals, dataRetention, telemetryEnabled, updatesDisabled, backupEnabled, sttEnabled, dbaasEnabled, azureDiscoverEnabled, publicAddress, alertingEnabled, telemetrySummaries, enableAccessControl, } = settings;
    const settingsStyles = useStyles2(getSettingsStyles);
    const { rareInterval, standardInterval, frequentInterval } = convertCheckIntervalsToHours(sttCheckIntervals);
    const { advanced: { action, retentionLabel, retentionTooltip, retentionUnits, telemetryLabel, telemetryLink, telemetryTooltip, telemetrySummaryTitle, telemetryDisclaimer, updatesLabel, updatesLink, updatesTooltip, advisorsLabel, advisorsLink, advisorsTooltip, dbaasLabel, dbaasTooltip, dbaasLink, publicAddressLabel, publicAddressTooltip, publicAddressButton, accessControl, accessControlTooltip, accessControlLink, alertingLabel, alertingTooltip, alertingLink, azureDiscoverLabel, azureDiscoverTooltip, azureDiscoverLink, technicalPreviewLegend, technicalPreviewDescription, technicalPreviewLinkText, backupLabel, backupLink, backupTooltip, deprecatedFeatures, }, tooltipLinkText, } = Messages;
    const initialValues = {
        retention: convertSecondsToDays(dataRetention),
        telemetry: telemetryEnabled,
        updates: !updatesDisabled,
        backup: backupEnabled,
        stt: sttEnabled,
        dbaas: dbaasEnabled,
        azureDiscover: azureDiscoverEnabled,
        publicAddress,
        alerting: alertingEnabled,
        rareInterval,
        standardInterval,
        frequentInterval,
        telemetrySummaries,
        accessControl: enableAccessControl,
    };
    const [loading, setLoading] = useState(false);
    const applyChanges = (values) => __awaiter(void 0, void 0, void 0, function* () {
        const { retention, telemetry, stt, publicAddress, dbaas, alerting, backup, azureDiscover, rareInterval, standardInterval, frequentInterval, updates, accessControl, } = values;
        const sttCheckIntervals = {
            rare_interval: `${convertHoursStringToSeconds(rareInterval)}s`,
            standard_interval: `${convertHoursStringToSeconds(standardInterval)}s`,
            frequent_interval: `${convertHoursStringToSeconds(frequentInterval)}s`,
        };
        const body = {
            data_retention: `${+retention * SECONDS_IN_DAY}s`,
            disable_telemetry: !telemetry,
            enable_telemetry: telemetry,
            disable_stt: !stt,
            enable_stt: stt,
            disable_azurediscover: !azureDiscover,
            enable_azurediscover: azureDiscover,
            pmm_public_address: publicAddress,
            remove_pmm_public_address: !publicAddress,
            enable_alerting: alerting ? true : undefined,
            disable_alerting: !alerting ? true : undefined,
            stt_check_intervals: !!stt ? sttCheckIntervals : undefined,
            enable_backup_management: backup,
            disable_backup_management: !backup,
            enable_dbaas: dbaas,
            disable_dbaas: !dbaas,
            enable_updates: updates,
            disable_updates: !updates,
            enable_access_control: accessControl,
            disable_access_control: !accessControl,
        };
        setLoading(true);
        yield dispatch(updateSettingsAction({
            body,
            token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        }));
        setLoading(false);
    });
    const { Form } = withTypes();
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: styles.advancedWrapper },
                    React.createElement(Form, { onSubmit: applyChanges, initialValues: initialValues, mutators: {
                            setPublicAddress: ([publicAddressValue], state, { changeValue }) => {
                                var _a, _b;
                                if (!((_a = state === null || state === void 0 ? void 0 : state.lastFormState) === null || _a === void 0 ? void 0 : _a.values['publicAddress']) &&
                                    ((_b = state === null || state === void 0 ? void 0 : state.lastFormState) === null || _b === void 0 ? void 0 : _b.values['dbaas']) === true) {
                                    changeValue(state, 'publicAddress', () => publicAddressValue);
                                }
                            },
                        }, render: ({ form: { change, mutators }, values, handleSubmit, valid, pristine }) => (React.createElement("form", { onSubmit: handleSubmit },
                            React.createElement("div", { className: styles.advancedRow },
                                React.createElement("div", { className: styles.advancedCol },
                                    React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "advanced-label" },
                                        React.createElement("span", null, retentionLabel),
                                        React.createElement(LinkTooltip, { tooltipContent: retentionTooltip, link: Messages.advanced.retentionLink, linkText: tooltipLinkText, icon: "info-circle" }))),
                                React.createElement("div", { className: styles.inputWrapper },
                                    React.createElement(NumberInputField, { name: "retention", validators: [validators.required, validators.range(MIN_DAYS, MAX_DAYS)] })),
                                React.createElement("span", { className: styles.unitsLabel }, retentionUnits)),
                            React.createElement(Field, { name: "telemetry", type: "checkbox", label: telemetryLabel, tooltip: React.createElement(TelemetryTooltip, { telemetryTooltip: telemetryTooltip, telemetrySummaryTitle: telemetrySummaryTitle, telemetrySummaries: telemetrySummaries }), tooltipLinkText: tooltipLinkText, link: telemetryLink, dataTestId: "advanced-telemetry", component: SwitchRow }),
                            React.createElement("div", { className: styles.infoBox },
                                React.createElement(Icon, { name: "info-circle", size: "xl", className: styles.infoBoxIcon }),
                                React.createElement("p", null, telemetryDisclaimer)),
                            React.createElement(Field, { name: "updates", type: "checkbox", label: updatesLabel, tooltip: updatesTooltip, tooltipLinkText: tooltipLinkText, link: updatesLink, dataTestId: "advanced-updates", component: SwitchRow }),
                            React.createElement(Field, { name: "stt", type: "checkbox", label: advisorsLabel, tooltip: advisorsTooltip, tooltipLinkText: tooltipLinkText, link: advisorsLink, dataTestId: "advanced-advisors", component: SwitchRow }),
                            React.createElement(Field, { name: "alerting", type: "checkbox", label: alertingLabel, tooltip: alertingTooltip, tooltipLinkText: tooltipLinkText, link: alertingLink, dataTestId: "advanced-alerting", component: SwitchRow }),
                            React.createElement(Field, { name: "backup", type: "checkbox", label: backupLabel, tooltip: backupTooltip, tooltipLinkText: tooltipLinkText, link: backupLink, dataTestId: "advanced-backup", component: SwitchRow }),
                            React.createElement("div", { className: styles.advancedRow },
                                React.createElement("div", { className: cx(styles.advancedCol, styles.publicAddressLabelWrapper) },
                                    React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "public-address-label" },
                                        React.createElement("span", null, publicAddressLabel),
                                        React.createElement(LinkTooltip, { tooltipContent: publicAddressTooltip, icon: "info-circle" }))),
                                React.createElement("div", { className: styles.publicAddressWrapper },
                                    React.createElement(TextInputField, { name: "publicAddress", className: styles.publicAddressInput }),
                                    React.createElement(Button, { className: styles.publicAddressButton, type: "button", variant: "secondary", "data-testid": "public-address-button", onClick: () => change('publicAddress', window.location.host) },
                                        React.createElement(Icon, { name: "link" }),
                                        publicAddressButton))),
                            React.createElement("div", { className: styles.advancedRow },
                                React.createElement("div", { className: cx(styles.advancedCol, styles.advancedChildCol, styles.sttCheckIntervalsLabel) },
                                    React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "check-intervals-label" },
                                        React.createElement("span", null, sttCheckIntervalsLabel),
                                        React.createElement(LinkTooltip, { tooltipContent: sttCheckIntervalTooltip, icon: "info-circle" })))),
                            STT_CHECK_INTERVALS.map(({ label, name }) => (React.createElement("div", { key: name, className: styles.advancedRow },
                                React.createElement("div", { className: cx(styles.advancedCol, styles.advancedChildCol) },
                                    React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": `check-interval-${name}-label` },
                                        React.createElement("span", null, label))),
                                React.createElement("div", { className: styles.inputWrapper },
                                    React.createElement(NumberInputField, { inputProps: { step: STT_CHECK_INTERVAL_STEP, min: MIN_STT_CHECK_INTERVAL }, disabled: !values.stt, name: name, validators: [validators.required, validators.min(MIN_STT_CHECK_INTERVAL)] })),
                                React.createElement("span", { className: styles.unitsLabel }, sttCheckIntervalUnit)))),
                            React.createElement("fieldset", { className: styles.technicalPreview },
                                React.createElement("legend", null, technicalPreviewLegend),
                                React.createElement("div", { className: styles.infoBox },
                                    React.createElement(Icon, { name: "info-circle", size: "xl", className: styles.infoBoxIcon }),
                                    React.createElement("p", null,
                                        technicalPreviewDescription,
                                        ' ',
                                        React.createElement("a", { href: TECHNICAL_PREVIEW_DOC_URL, target: "_blank", rel: "noreferrer" }, technicalPreviewLinkText))),
                                React.createElement(Field, { name: "azureDiscover", type: "checkbox", label: azureDiscoverLabel, tooltip: azureDiscoverTooltip, tooltipLinkText: tooltipLinkText, link: azureDiscoverLink, dataTestId: "advanced-azure-discover", component: SwitchRow }),
                                React.createElement(Field, { name: "accessControl", type: "checkbox", label: accessControl, tooltip: accessControlTooltip, tooltipLinkText: tooltipLinkText, link: accessControlLink, dataTestId: "access-control", component: SwitchRow })),
                            React.createElement("fieldset", { className: styles.technicalPreview },
                                React.createElement("legend", null, deprecatedFeatures),
                                !!values.dbaas && React.createElement(DbaasDeprecationWarning, null),
                                React.createElement(Field, { name: "dbaas", type: "checkbox", label: dbaasLabel, tooltip: dbaasTooltip, tooltipLinkText: tooltipLinkText, link: dbaasLink, dataTestId: "advanced-dbaas", component: SwitchRow, 
                                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                    onChange: (event, input) => {
                                        dBaaSToggleOnChange(event, input, mutators);
                                    } })),
                            React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: !valid || pristine || loading, "data-testid": "advanced-button" },
                                loading && React.createElement(Spinner, null),
                                action))) }))))));
};
const TelemetryTooltip = ({ telemetryTooltip, telemetrySummaryTitle, telemetrySummaries, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.telemetryTooltip, "data-testid": "info-tooltip" },
        React.createElement("p", null, telemetryTooltip),
        React.createElement("p", null, telemetrySummaryTitle),
        React.createElement("ul", { className: styles.telemetryListTooltip }, telemetrySummaries.map((summary) => (React.createElement("li", { key: summary }, summary))))));
};
export default Advanced;
//# sourceMappingURL=Advanced.js.map