import React, { FC, useMemo, useState } from 'react';
import { TabsBar, TabContent, Tab, useStyles } from '@grafana/ui';
import { Messages } from './IntegratedAlerting.messages';
import { getStyles } from './IntegratedAlerting.styles';
import { TabKeys } from './IntegratedAlerting.types';

const IntegratedAlertingPage: FC = () => {
  const styles = useStyles(getStyles);
  const [activeTab, setActiveTab] = useState(TabKeys.alerts);
  const tabs = useMemo(
    () => [
      {
        label: Messages.tabs.alerts,
        key: TabKeys.alerts,
        component: <div key={TabKeys.alerts}>{Messages.tabs.alerts}</div>,
      },
      {
        label: Messages.tabs.alertRules,
        key: TabKeys.alertRules,
        component: <div key={TabKeys.alertRules}>{Messages.tabs.alertRules}</div>,
      },
      {
        label: Messages.tabs.alertRuleTemplates,
        key: TabKeys.alertRuleTemplates,
        component: <div key={TabKeys.alertRuleTemplates}>{Messages.tabs.alertRuleTemplates}</div>,
      },
      {
        label: Messages.tabs.notificationChannels,
        key: TabKeys.notificationChannels,
        component: <div key={TabKeys.notificationChannels}>{Messages.tabs.notificationChannels}</div>,
      },
    ],
    []
  );

  return (
    <div className={styles.integratedAlertingWrapper}>
      <TabsBar>
        {tabs.map(tab => (
          <Tab
            key={tab.key}
            label={tab.label}
            active={tab.key === activeTab}
            onChangeTab={() => setActiveTab(tab.key)}
          />
        ))}
      </TabsBar>
      <TabContent>{tabs.find(tab => tab.key === activeTab).component}</TabContent>
    </div>
  );
};

export default IntegratedAlertingPage;
