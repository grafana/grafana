import moment from 'moment';
import React, { useCallback, useMemo, useState } from 'react';

import { Button, CellProps, Column, Drawer, InteractiveTable, Stack, Tab, TabsBar, Text } from '@grafana/ui';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { Spacer } from '../Spacer';

import AlertmanagerConfig from './AlertmanagerConfig';
import { useSettings } from './SettingsContext';

type ActiveTab = 'configuration' | 'versions';

export function useEditConfigurationDrawer(): [React.ReactNode, (dataSourceName: string) => void, () => void] {
  const [activeTab, setActiveTab] = useState<ActiveTab>('configuration');
  const [dataSourceName, setDataSourceName] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const { updateAlertmanagerSettings, resetAlertmanagerSettings } = useSettings();

  const showConfiguration = useCallback((dataSourceName: string) => {
    setDataSourceName(dataSourceName);
    setOpen(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveTab('configuration');
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    const handleReset = (uid: string) => {
      resetAlertmanagerSettings(uid);
    };

    const isGrafanaAlertmanager = dataSourceName === GRAFANA_RULES_SOURCE_NAME;
    const title = isGrafanaAlertmanager ? 'Internal Grafana Alertmanager' : dataSourceName;

    // @todo check copy
    return (
      <Drawer
        onClose={handleDismiss}
        title={title}
        subtitle="Edit the Alertmanager configuration"
        size="lg"
        tabs={
          <TabsBar>
            <Tab
              label="Configuration"
              key="configuration"
              active={activeTab === 'configuration'}
              onChangeTab={() => setActiveTab('configuration')}
            />
            <Tab
              label="Versions"
              key="versions"
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
            onReset={handleReset}
          />
        )}
        {activeTab === 'versions' && dataSourceName && (
          <AlertmanagerConfigurationVersionManager alertmanagerName={dataSourceName} />
        )}
      </Drawer>
    );
  }, [open, dataSourceName, handleDismiss, activeTab, updateAlertmanagerSettings, resetAlertmanagerSettings]);

  return [drawer, showConfiguration, handleDismiss];
}

const VERSIONS_PAGE_SIZE = 30;

interface AlertmanagerConfigurationVersionManagerProps {
  alertmanagerName: string;
}

type VersionData = {
  id: string;
  lastAppliedAt: string;
};

const AlertmanagerConfigurationVersionManager = ({
  alertmanagerName,
}: AlertmanagerConfigurationVersionManagerProps) => {
  const { currentData: previousVersions = [], isLoading: isLoadingPreviousVersions } =
    alertmanagerApi.endpoints.getValidAlertManagersConfig.useQuery();

  const [resetAlertManagerConfigToOldVersion] =
    alertmanagerApi.endpoints.resetAlertManagerConfigToOldVersion.useMutation();

  if (isLoadingPreviousVersions) {
    return 'Loading...';
  }

  if (!previousVersions.length) {
    return 'No previous configurations';
  }

  const rows: VersionData[] = previousVersions.map((version) => ({
    id: String(version.id ?? 0),
    lastAppliedAt: version.last_applied ?? 'unknown',
  }));

  const columns: Array<Column<VersionData>> = [
    { id: 'id', header: 'ID' },
    { id: 'lastAppliedAt', header: 'Last applied', cell: LastAppliedCell },
  ];

  return <InteractiveTable pageSize={VERSIONS_PAGE_SIZE} columns={columns} data={rows} getRowId={(row) => row.id} />;
};

const LastAppliedCell = ({ value }: CellProps<VersionData>) => {
  const date = moment(value);

  return (
    <Stack direction="row" alignItems="center">
      {date.toLocaleString()}
      <Text variant="bodySmall" color="secondary">
        {date.fromNow()}
      </Text>
      <Spacer />
      {/* TODO make sure we ask for confirmation! */}
      <Button variant="secondary" size="sm" icon="pathfinder" fill="outline" onClick={() => {}}>
        Compare
      </Button>
      <Button variant="secondary" size="sm" icon="history" onClick={() => {}}>
        Restore
      </Button>
    </Stack>
  );
};
