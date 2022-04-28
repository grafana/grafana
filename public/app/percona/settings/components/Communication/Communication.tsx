import React, { FC, useCallback, useMemo, useState } from 'react';
import { cx } from '@emotion/css';
import { Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'app/store/store';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';
import { EmailPayload, SettingsAPIChangePayload } from '../../Settings.types';
import { Email } from './Email/Email';
import { Slack } from './Slack/Slack';
import { Messages } from './Communication.messages';
import { CommunicationService } from './Communication.service';
import { WithDiagnostics } from '../WithDiagnostics/WithDiagnostics';

export const Communication: FC = () => {
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
    <Page navModel={navModel} vertical tabsDataTestId="settings-tabs">
      <Page.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <WithDiagnostics>
            <div className={cx(settingsStyles.wrapper)}>
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
          </WithDiagnostics>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Communication;
