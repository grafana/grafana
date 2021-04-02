import React, { FC, useEffect, useState } from 'react';
import { Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { IntegratedAlertingContent } from './components/IntegratedAlertingContent';
import { getStyles } from './IntegratedAlerting.styles';
import { IntegratedAlertingService } from './IntegratedAlerting.service';
import { DEFAULT_TAB, PAGE_MODEL, PAGE_TABS } from './IntegratedAlerting.constants';
import { TabKeys } from './IntegratedAlerting.types';
import { AlertRules, AlertRuleTemplate, Alerts, NotificationChannel } from './components';
import { getLocationSrv } from '@grafana/runtime';
import { UrlQueryValue } from '@grafana/data';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';

const tabComponentMap = [
  {
    id: TabKeys.alerts,
    component: <Alerts key={TabKeys.alerts} />,
  },
  {
    id: TabKeys.alertRules,
    component: <AlertRules key={TabKeys.alertRules} />,
  },
  {
    id: TabKeys.alertRuleTemplates,
    component: <AlertRuleTemplate key={TabKeys.alertRuleTemplates} />,
  },
  {
    id: TabKeys.notificationChannels,
    component: <NotificationChannel key={TabKeys.notificationChannels} />,
  },
];

const IntegratedAlertingPage: FC = () => {
  const styles = useStyles(getStyles);
  const tabKey = useSelector((state: StoreState) => state.location.routeParams.tab);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [alertingEnabled, setAlertingEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);

  const { path: basePath } = PAGE_MODEL;

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);

  const selectTab = (selectedTabKey: string) => {
    if (selectedTabKey !== tabKey) {
      getLocationSrv().update({
        path: `${basePath}/${selectedTabKey}`,
      });
    }
  };

  const getSettings = async () => {
    setLoadingSettings(true);

    try {
      const {
        settings: { alerting_enabled },
      } = await IntegratedAlertingService.getSettings();
      setAlertingEnabled(!!alerting_enabled);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    isValidTab(tabKey) || selectTab(DEFAULT_TAB);
  }, []);

  useEffect(() => {
    setActiveTab(isValidTab(tabKey) ? (tabKey as TabKeys) : DEFAULT_TAB);
  }, [tabKey]);

  useEffect(() => {
    getSettings();
  }, []);

  return (
    <div className={styles.integratedAlertingWrapper}>
      <Breadcrumb pageModel={PAGE_MODEL} />
      <TechnicalPreview />
      <TabsBar>
        {PAGE_TABS.map(tab => (
          <Tab key={tab.id} label={tab.title} active={tab.id === activeTab} onChangeTab={() => selectTab(tab.id)} />
        ))}
      </TabsBar>
      <IntegratedAlertingContent loadingSettings={loadingSettings} alertingEnabled={alertingEnabled}>
        <TabContent>{tabComponentMap.find(tab => tab.id === activeTab).component}</TabContent>
      </IntegratedAlertingContent>
    </div>
  );
};

export default IntegratedAlertingPage;
