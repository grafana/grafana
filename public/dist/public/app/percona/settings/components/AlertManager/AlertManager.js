import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { Field, Form } from 'react-final-form';
import { Button, Input, Spinner, TextArea, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { SET_SETTINGS_CANCEL_TOKEN, AM_WARNING_URL } from '../../Settings.constants';
import { getStyles } from './AlertManager.styles';
export const AlertManager = () => {
    const styles = useStyles2(getStyles);
    const settingsStyles = useStyles2(getSettingsStyles);
    const { alertmanager: { action, rulesLabel, rulesLink, rulesTooltip, urlLabel, urlLink, urlTooltip, warningPre, warningLinkContent, warningPost, }, tooltipLinkText, } = Messages;
    const [loading, setLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const { result: settings } = useSelector(getPerconaSettings);
    const dispatch = useAppDispatch();
    const navModel = usePerconaNavModel('settings-alert-manager');
    const { alertManagerUrl, alertManagerRules } = settings;
    const initialValues = {
        url: alertManagerUrl,
        rules: alertManagerRules,
    };
    const isEqual = (a, b) => (!a && !b) || a === b;
    const applyChanges = ({ url, rules }) => __awaiter(void 0, void 0, void 0, function* () {
        const body = {
            alert_manager_url: url,
            alert_manager_rules: rules,
        };
        if (!url) {
            body.remove_alert_manager_url = true;
        }
        if (!rules) {
            body.remove_alert_manager_rules = true;
        }
        setLoading(true);
        yield dispatch(updateSettingsAction({
            body,
            token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        }));
        setLoading(false);
    });
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: cx(settingsStyles.wrapper, styles.alertManagerWrapper) },
                    React.createElement(Form, { onSubmit: applyChanges, initialValues: initialValues, render: ({ handleSubmit, pristine }) => (React.createElement("form", { onSubmit: handleSubmit },
                            React.createElement("div", { className: settingsStyles.labelWrapper, "data-testid": "alertmanager-url-label" },
                                React.createElement("strong", { className: styles.warning },
                                    warningPre,
                                    ' ',
                                    React.createElement("a", { className: styles.warningLink, href: AM_WARNING_URL }, warningLinkContent),
                                    ' ',
                                    warningPost),
                                React.createElement("span", null, urlLabel),
                                React.createElement(LinkTooltip, { tooltipContent: urlTooltip, link: urlLink, linkText: tooltipLinkText, icon: "info-circle" })),
                            React.createElement(Field, { name: "url", isEqual: isEqual, render: ({ input }) => React.createElement(Input, Object.assign({}, input, { className: styles.input, "data-testid": "alertmanager-url" })) }),
                            React.createElement("div", { className: cx(settingsStyles.labelWrapper, styles.rulesLabel), "data-testid": "alertmanager-rules-label" },
                                React.createElement("span", null, rulesLabel),
                                React.createElement(LinkTooltip, { tooltipContent: rulesTooltip, link: rulesLink, linkText: tooltipLinkText, icon: "info-circle" })),
                            React.createElement(Field, { name: "rules", isEqual: isEqual, render: ({ input }) => (React.createElement(TextArea, Object.assign({}, input, { className: styles.textarea, "data-testid": "alertmanager-rules" }))) }),
                            React.createElement(Button, { className: settingsStyles.actionButton, type: "submit", disabled: pristine || loading, "data-testid": "alertmanager-button" },
                                loading && React.createElement(Spinner, null),
                                action))) }))))));
};
export default AlertManager;
//# sourceMappingURL=AlertManager.js.map