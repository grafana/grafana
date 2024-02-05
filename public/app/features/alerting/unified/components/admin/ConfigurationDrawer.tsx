import React, { useCallback, useMemo, useState } from 'react';

import { Drawer } from '@grafana/ui';

import AlertmanagerConfig from './AlertmanagerConfig';
import { useSettings } from './SettingsContext';

export function useEditConfigurationDrawer(): [React.ReactNode, (dataSourceName: string) => void, () => void] {
  const [dataSourceName, setDataSourceName] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const { updateAlertmanagerSettings, resetAlertmanagerSettings } = useSettings();

  const showConfiguration = useCallback((dataSourceName: string) => {
    setDataSourceName(dataSourceName);
    setOpen(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    const handleSave = (uid: string) => {
      updateAlertmanagerSettings(uid);
    };

    const handleReset = (uid: string) => {
      resetAlertmanagerSettings(uid);
    };

    // @todo check copy
    return (
      <Drawer
        onClose={handleDismiss}
        title="Alertmanager name here"
        subtitle="This is the Alertmanager configuration"
        size="lg"
      >
        {dataSourceName && <AlertmanagerConfig alertmanagerName={dataSourceName} onDismiss={handleDismiss} />}
      </Drawer>
    );
  }, [handleDismiss, open, dataSourceName, updateAlertmanagerSettings, resetAlertmanagerSettings]);

  return [drawer, showConfiguration, handleDismiss];
}
