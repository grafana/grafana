import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { Messages } from './Communication.messages';
import { CommunicationService } from './Communication.service';
import { Email } from './Email/Email';
import { Slack } from './Slack/Slack';
export const Communication = () => {
    const settingsStyles = useStyles2(getSettingsStyles);
    const [activeTab, setActiveTab] = useState(Messages.tabs.email.key);
    const dispatch = useAppDispatch();
    const [generateToken] = useCancelToken();
    const navModel = usePerconaNavModel('settings-communication');
    const { result: settings } = useSelector(getPerconaSettings);
    const { alertingSettings } = settings;
    const testEmailSetting = (settings, email) => __awaiter(void 0, void 0, void 0, function* () { return CommunicationService.testEmailSettings(settings, email); });
    const updateSettings = useCallback((body) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(updateSettingsAction({
            body,
            token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        }));
    }), [dispatch, generateToken]);
    const tabs = useMemo(() => [
        {
            label: Messages.tabs.email.label,
            key: Messages.tabs.email.key,
            active: activeTab === Messages.tabs.email.key,
            component: (React.createElement(Email, { key: "email", testSettings: testEmailSetting, updateSettings: updateSettings, settings: alertingSettings.email })),
        },
        {
            label: Messages.tabs.slack.label,
            key: Messages.tabs.slack.key,
            active: activeTab === Messages.tabs.slack.key,
            component: React.createElement(Slack, { key: "slack", updateSettings: updateSettings, settings: alertingSettings.slack }),
        },
    ], [activeTab, updateSettings, alertingSettings.email, alertingSettings.slack]);
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null,
                React.createElement("div", { className: cx(settingsStyles.wrapper) },
                    React.createElement(Alert, { title: "Communication settings", severity: "warning", "data-testid": "communication-warning" }, "This page is deprecated for now. Please resort to Grafana's SMTP settings via .ini file and use Contact Points to setup Slack notifications."),
                    React.createElement(TabsBar, null, tabs.map((tab, index) => (React.createElement(Tab, { key: index, label: tab.label, active: tab.key === activeTab, onChangeTab: () => setActiveTab(tab.key) })))),
                    React.createElement(TabContent, { className: settingsStyles.tabs }, tabs.map((tab) => tab.key === activeTab && tab.component)))))));
};
export default Communication;
//# sourceMappingURL=Communication.js.map