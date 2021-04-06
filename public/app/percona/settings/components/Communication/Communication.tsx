import React, { FC, useMemo, useState } from 'react';
import { Tab, TabContent, TabsBar, useTheme } from '@grafana/ui';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { cx } from 'emotion';
import { CommunicationProps } from './Communication.types';
import { Email } from './Email/Email';
import { Slack } from './Slack/Slack';
import { Messages } from './Communication.messages';

export const Communication: FC<CommunicationProps> = ({ alertingSettings, updateSettings }) => {
  const theme = useTheme();
  const settingsStyles = getSettingsStyles(theme);
  const [activeTab, setActiveTab] = useState(Messages.tabs.email.key);

  const tabs = useMemo(
    () => [
      {
        label: Messages.tabs.email.label,
        key: Messages.tabs.email.key,
        active: activeTab === Messages.tabs.email.key,
        component: <Email key="email" updateSettings={updateSettings} settings={alertingSettings.email} />,
      },
      {
        label: Messages.tabs.slack.label,
        key: Messages.tabs.slack.key,
        active: activeTab === Messages.tabs.slack.key,
        component: <Slack key="slack" updateSettings={updateSettings} settings={alertingSettings.slack} />,
      },
    ],
    [alertingSettings]
  );

  return (
    <div className={cx(settingsStyles.wrapper)}>
      <TabsBar>
        {tabs.map((tab, index) => (
          <Tab key={index} label={tab.label} active={tab.key === activeTab} onChangeTab={() => setActiveTab(tab.key)} />
        ))}
      </TabsBar>
      <TabContent>{tabs.map(tab => tab.key === activeTab && tab.component)}</TabContent>
    </div>
  );
};
