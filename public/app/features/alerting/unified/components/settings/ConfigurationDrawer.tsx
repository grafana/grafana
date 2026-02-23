import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { Drawer, Tab, TabsBar } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';

import AlertmanagerConfig from './AlertmanagerConfig';
import { useSettings } from './SettingsContext';
import { AlertmanagerConfigurationVersionManager } from './VersionManager';

type ActiveTab = 'configuration' | 'versions';

export function useEditConfigurationDrawer() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('configuration');
  const [dataSourceName, setDataSourceName] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const { updateAlertmanagerSettings, resetAlertmanagerSettings } = useSettings();

  const isGrafanaManagedAlertmanager = dataSourceName === GRAFANA_RULES_SOURCE_NAME;
  const immutableDataSource = dataSourceName ? isVanillaPrometheusAlertManagerDataSource(dataSourceName) : false;
  const readOnly = immutableDataSource || isGrafanaManagedAlertmanager;

  const showConfiguration = (dataSourceName: string) => {
    setDataSourceName(dataSourceName);
    setOpen(true);
  };

  const handleDismiss = useCallback(() => {
    setActiveTab('configuration');
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    const isGrafanaAlertmanager = dataSourceName === GRAFANA_RULES_SOURCE_NAME;
    const title = isGrafanaAlertmanager
      ? t(
          'alerting.use-edit-configuration-drawer.drawer.internal-grafana-alertmanager-title',
          'Grafana built-in Alertmanager'
        )
      : dataSourceName;

    const subtitle = readOnly
      ? t(
          'alerting.use-edit-configuration-drawer.drawer.title-view-the-alertmanager-configuration',
          'View Alertmanager configuration'
        )
      : t(
          'alerting.use-edit-configuration-drawer.drawer.title-edit-the-alertmanager-configuration',
          'Edit Alertmanager configuration'
        );

    // @todo check copy
    return (
      <Drawer
        onClose={handleDismiss}
        title={title}
        subtitle={subtitle}
        tabs={
          <TabsBar>
            <Tab
              label={t('alerting.use-edit-configuration-drawer.drawer.label-json-model', 'JSON Model')}
              key="configuration"
              icon="arrow"
              active={activeTab === 'configuration'}
              onChangeTab={() => setActiveTab('configuration')}
            />
            <Tab
              label={t('alerting.use-edit-configuration-drawer.drawer.label-versions', 'Versions')}
              key="versions"
              icon="history"
              active={activeTab === 'versions'}
              onChangeTab={() => setActiveTab('versions')}
              hidden={!isGrafanaAlertmanager}
            />
          </TabsBar>
        }
      >
        {activeTab === 'configuration' && dataSourceName && (
          <AlertmanagerConfig
            alertmanagerName={dataSourceName}
            onDismiss={handleDismiss}
            onSave={updateAlertmanagerSettings}
            onReset={resetAlertmanagerSettings}
          />
        )}
        {activeTab === 'versions' && dataSourceName && (
          <AlertmanagerConfigurationVersionManager alertmanagerName={dataSourceName} />
        )}
      </Drawer>
    );
  }, [open, dataSourceName, readOnly, handleDismiss, activeTab, updateAlertmanagerSettings, resetAlertmanagerSettings]);

  return [drawer, showConfiguration, handleDismiss] as const;
}
