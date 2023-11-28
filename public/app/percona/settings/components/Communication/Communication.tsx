import { cx } from '@emotion/css';
import React, { FC, useCallback, useMemo, useState } from 'react';

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
import { EmailPayload, SettingsAPIChangePayload } from '../../Settings.types';

import { Messages } from './Communication.messages';
import { CommunicationService } from './Communication.service';
import { Email } from './Email/Email';
import { Slack } from './Slack/Slack';

export const Communication: FC<React.PropsWithChildren<unknown>> = () => {
  const settingsStyles = useStyles2(getSettingsStyles);
  const [activeTab, setActiveTab] = useState(Messages.tabs.email.key);
  const dispatch = useAppDispatch();
  const [generateToken] = useCancelToken();
  const navModel = usePerconaNavModel('settings-communication');
  const { result: settings } = useSelector(getPerconaSettings);
  const { alertingSettings } = settings!;

  const testEmailSetting = async (settings: EmailPayload, email: string): Promise<void> =>
    CommunicationService.testEmailSettings(settings, email);

  const updateSettings = useCallback(
    async (body: Partial<SettingsAPIChangePayload>) => {
      await dispatch(
        updateSettingsAction({
          body,
          token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
        })
      );
    },
    [dispatch, generateToken]
  );

  const tabs = useMemo(
    () => [
      {
        label: Messages.tabs.email.label,
        key: Messages.tabs.email.key,
        active: activeTab === Messages.tabs.email.key,
        component: (
          <Email
            key="email"
            testSettings={testEmailSetting}
            updateSettings={updateSettings}
            settings={alertingSettings.email}
          />
        ),
      },
      {
        label: Messages.tabs.slack.label,
        key: Messages.tabs.slack.key,
        active: activeTab === Messages.tabs.slack.key,
        component: <Slack key="slack" updateSettings={updateSettings} settings={alertingSettings.slack} />,
      },
    ],
    [activeTab, updateSettings, alertingSettings.email, alertingSettings.slack]
  );

  return (
    <OldPage navModel={navModel} vertical tabsDataTestId="settings-tabs">
      <OldPage.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <div className={cx(settingsStyles.wrapper)}>
            <Alert title="Communication settings" severity="warning" data-testid="communication-warning">
              This page is deprecated for now. Please resort to Grafana&apos;s SMTP settings via .ini file and use
              Contact Points to setup Slack notifications.
            </Alert>
            <TabsBar>
              {tabs.map((tab, index) => (
                <Tab
                  key={index}
                  label={tab.label}
                  active={tab.key === activeTab}
                  onChangeTab={() => setActiveTab(tab.key)}
                />
              ))}
            </TabsBar>
            <TabContent className={settingsStyles.tabs}>
              {tabs.map((tab) => tab.key === activeTab && tab.component)}
            </TabContent>
          </div>
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default Communication;
