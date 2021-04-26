import React, { FC, useEffect, useMemo, useState } from 'react';
import { Spinner, useTheme } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Advanced, AlertManager, Diagnostics, MetricsResolution, PlatformLogin, SSHKey } from './components';
import { LoadingCallback, SettingsService } from './Settings.service';
import { Settings, TabKeys, SettingsAPIChangePayload } from './Settings.types';
import { Messages } from './Settings.messages';
import { getSettingsStyles } from './Settings.styles';
import { GET_SETTINGS_CANCEL_TOKEN, SET_SETTINGS_CANCEL_TOKEN } from './Settings.constants';
import { Communication } from './components/Communication/Communication';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { PAGE_MODEL } from './Settings.constants';
import { ContentTab, TabbedContent, TabOrientation } from '../shared/components/Elements/TabbedContent';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';

export const SettingsPanel: FC = () => {
  const { path: basePath } = PAGE_MODEL;
  const [generateToken] = useCancelToken();

  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const styles = getSettingsStyles(theme);
  const { metrics, advanced, ssh, alertManager, perconaPlatform, communication } = Messages.tabs;
  const [settings, setSettings] = useState<Settings>();

  const updateSettings = async (
    body: SettingsAPIChangePayload,
    callback: LoadingCallback,
    refresh?: boolean,
    onError = () => {}
  ) => {
    const response = await SettingsService.setSettings(body, callback, generateToken(SET_SETTINGS_CANCEL_TOKEN));
    const { email_alerting_settings: { password = '' } = {} } = body;

    if (refresh && response) {
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
    } else {
      onError();
    }
  };

  const tabs: ContentTab[] = useMemo(
    (): ContentTab[] =>
      settings
        ? [
            {
              label: metrics,
              key: TabKeys.metrics,
              component: (
                <MetricsResolution metricsResolutions={settings.metricsResolutions} updateSettings={updateSettings} />
              ),
            },
            {
              label: advanced,
              key: TabKeys.advanced,
              component: (
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
                  sttCheckIntervals={settings.sttCheckIntervals}
                />
              ),
            },
            {
              label: ssh,
              key: TabKeys.ssh,
              component: <SSHKey sshKey={settings.sshKey || ''} updateSettings={updateSettings} />,
            },
            {
              label: alertManager,
              key: TabKeys.alertManager,
              component: (
                <AlertManager
                  alertManagerUrl={settings.alertManagerUrl || ''}
                  alertManagerRules={settings.alertManagerRules || ''}
                  updateSettings={updateSettings}
                />
              ),
            },
            {
              label: perconaPlatform,
              key: TabKeys.perconaPlatform,
              component: <PlatformLogin userEmail={settings.platformEmail} getSettings={getSettings} />,
            },
            {
              label: communication,
              key: TabKeys.communication,
              hidden: !settings?.alertingEnabled,
              component: (
                <Communication
                  alertingSettings={settings.alertingSettings}
                  alertingEnabled={!!settings.alertingEnabled}
                  updateSettings={updateSettings}
                />
              ),
            },
          ]
        : [],
    [settings]
  );

  const getSettings = async () => {
    try {
      setLoading(true);
      const settings = await SettingsService.getSettings(generateToken(GET_SETTINGS_CANCEL_TOKEN));
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
        {loading ? (
          <Spinner />
        ) : (
          <TabbedContent
            className={styles.tabsWrapper}
            tabs={tabs}
            basePath={basePath}
            orientation={TabOrientation.Vertical}
            tabsDataQa="settings-tabs"
            contentDataQa="settings-tab-content"
            renderTab={({ Content }) => <Content className={styles.tabContentWrapper} />}
          ></TabbedContent>
        )}
        <Diagnostics />
      </div>
    </PageWrapper>
  );
};
export default SettingsPanel;
