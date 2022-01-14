import { logger } from '@percona/platform-core';
import React, { FC, useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { StoreState } from 'app/types';

import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';

import { DEFAULT_TAB, PAGE_MODEL, PAGE_TABS } from './IntegratedAlerting.constants';
import { IntegratedAlertingService } from './IntegratedAlerting.service';
import { getStyles } from './IntegratedAlerting.styles';
import { TabKeys } from './IntegratedAlerting.types';
import { AlertRules, AlertRuleTemplate, Alerts, NotificationChannel } from './components';
import { IntegratedAlertingContent } from './components/IntegratedAlertingContent';

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

  const selectTab = useCallback(
    (selectedTabKey: string) => {
      if (selectedTabKey !== tabKey) {
        getLocationSrv().update({
          path: `${basePath}/${selectedTabKey}`,
        });
      }
    },
    [basePath, tabKey]
  );

  useEffect(() => {
    isValidTab(tabKey) || selectTab(DEFAULT_TAB);
  }, [selectTab, tabKey]);

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
        {PAGE_TABS.map((tab) => (
          <Tab key={tab.id} label={tab.title} active={tab.id === activeTab} onChangeTab={() => selectTab(tab.id)} />
        ))}
      </TabsBar>
      <IntegratedAlertingContent loadingSettings={loadingSettings} alertingEnabled={alertingEnabled}>
        <TabContent>{tabComponentMap.find((tab) => tab.id === activeTab).component}</TabContent>
      </IntegratedAlertingContent>
    </div>
  );
};

export default IntegratedAlertingPage;
