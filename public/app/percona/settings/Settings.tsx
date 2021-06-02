import React, { FC, useEffect, useMemo, useState } from 'react';
import { Spinner, Tab, TabContent, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import { logger } from '@percona/platform-core';
import { TabsVertical } from 'app/percona/shared/components/Elements/TabsVertical/TabsVertical';
import { Advanced, AlertManager, Diagnostics, MetricsResolution, PlatformLogin, SSHKey } from './components';
import { LoadingCallback, SettingsService } from './Settings.service';
import { Settings, TabKeys, SettingsAPIChangePayload } from './Settings.types';
import { Messages } from './Settings.messages';
import { getSettingsStyles } from './Settings.styles';
import { Communication } from './components/Communication/Communication';
import { useSelector } from 'react-redux';
import { StoreState } from '../../types';
import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { PageModel } from '../../core/components/Breadcrumb';

export const DEFAULT_TAB = TabKeys.metrics;

export const PAGE_TABS = [
  {
    title: Messages.tabs.metrics,
    id: TabKeys.metrics,
    path: `settings/${TabKeys.metrics}`,
  },
  {
    title: Messages.tabs.advanced,
    id: TabKeys.advanced,
    path: `settings/${TabKeys.advanced}`,
  },
  {
    title: Messages.tabs.ssh,
    id: TabKeys.ssh,
    path: `settings/${TabKeys.ssh}`,
  },
  {
    title: Messages.tabs.alertManager,
    id: TabKeys.alertManager,
    path: `settings/${TabKeys.alertManager}`,
  },
  {
    title: Messages.tabs.perconaPlatform,
    id: TabKeys.perconaPlatform,
    path: `settings/${TabKeys.perconaPlatform}`,
  },
  {
    title: Messages.tabs.communication,
    id: TabKeys.communication,
    path: `settings/${TabKeys.communication}`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Settings',
  path: 'settings',
  id: 'settings',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};

export const SettingsPanel: FC = () => {
  const { path: basePath } = PAGE_MODEL;

  const activeTab = useSelector((state: StoreState) => state.location.routeParams.tab);
  const isSamePage = useSelector((state: StoreState) => state.location.path.includes(basePath));

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);
  const selectTab = (tabKey: string) => {
    getLocationSrv().update({
      path: `${basePath}/${tabKey}`,
    });
  };
  useEffect(() => {
    if (!isSamePage) {
      return;
    }
    isValidTab(activeTab) || selectTab(DEFAULT_TAB);
  }, []);

  const theme = useTheme();
  const styles = getSettingsStyles(theme);
  const { metrics, advanced, ssh, alertManager, perconaPlatform, communication } = Messages.tabs;
  const [settings, setSettings] = useState<Settings>();
  const [loading, setLoading] = useState(true);

  const tabs = useMemo(
    () => [
      { label: metrics, key: TabKeys.metrics, active: activeTab === TabKeys.metrics },
      { label: advanced, key: TabKeys.advanced, active: activeTab === TabKeys.advanced },
      { label: ssh, key: TabKeys.ssh, active: activeTab === TabKeys.ssh },
      { label: alertManager, key: TabKeys.alertManager, active: activeTab === TabKeys.alertManager },
      { label: perconaPlatform, key: TabKeys.perconaPlatform, active: activeTab === TabKeys.perconaPlatform },
      {
        label: communication,
        key: TabKeys.communication,
        active: activeTab === TabKeys.communication,
        hidden: !settings?.alertingEnabled,
      },
    ],
    [activeTab, settings]
  );

  const updateSettings = async (body: SettingsAPIChangePayload, callback: LoadingCallback, refresh?: boolean) => {
    const response: Settings = await SettingsService.setSettings(body, callback);
    const { email_alerting_settings: { password = '' } = {} } = body;

    if (refresh) {
      window.location.reload();

      return;
    }

    if (response) {
      // password is not being returned by the API, hence this construction
      const newSettings: Settings = {
        ...response,
        alertingSettings: { ...response.alertingSettings, email: { ...response.alertingSettings.email, password } },
      };
      setSettings(newSettings);
    }
  };

  const getSettings = async () => {
    try {
      setLoading(true);
      const settings = await SettingsService.getSettings();
      setSettings(settings);
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={styles.settingsWrapper}>
        <TabsVertical className={styles.tabsWrapper} dataQa="settings-tabs">
          {tabs
            .filter(({ hidden }) => !hidden)
            .map((tab, index) => (
              <Tab key={index} label={tab.label} active={tab.active} onChangeTab={() => selectTab(tab.key)} />
            ))}
        </TabsVertical>
        <TabContent
          className={cx(styles.tabContentWrapper, { [styles.settingsLoading]: loading })}
          data-qa="settings-tab-content"
        >
          {loading && <Spinner />}
          {!loading && settings && (
            <>
              {tabs[0].active && (
                <MetricsResolution metricsResolutions={settings.metricsResolutions} updateSettings={updateSettings} />
              )}
              {tabs[1].active && (
                <Advanced
                  dataRetention={settings.dataRetention}
                  telemetryEnabled={!!settings.telemetryEnabled}
                  updatesDisabled={!!settings.updatesDisabled}
                  sttEnabled={!!settings.sttEnabled}
                  dbaasEnabled={!!settings.dbaasEnabled}
                  alertingEnabled={!!settings.alertingEnabled}
                  backupEnabled={!!settings.backupEnabled}
                  azureDiscoverEnabled={!!settings.azureDiscoverEnabled}
                  publicAddress={settings.publicAddress}
                  updateSettings={updateSettings}
                />
              )}
              {tabs[2].active && <SSHKey sshKey={settings.sshKey || ''} updateSettings={updateSettings} />}
              {tabs[3].active && (
                <AlertManager
                  alertManagerUrl={settings.alertManagerUrl || ''}
                  alertManagerRules={settings.alertManagerRules || ''}
                  updateSettings={updateSettings}
                />
              )}
              {tabs[4].active && <PlatformLogin userEmail={settings.platformEmail} getSettings={getSettings} />}

              {tabs[5].active && !tabs[5].hidden && (
                <Communication
                  alertingSettings={settings.alertingSettings}
                  alertingEnabled={!!settings.alertingEnabled}
                  updateSettings={updateSettings}
                />
              )}
            </>
          )}
        </TabContent>
        <Diagnostics />
      </div>
    </PageWrapper>
  );
};
export default SettingsPanel;
