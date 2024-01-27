import React, { useCallback, useMemo, useState } from 'react';

import { Drawer } from '@grafana/ui';

import AlertmanagerConfig from './AlertmanagerConfig';

export function useEditConfigurationDrawer(): [React.ReactNode, () => void, () => void] {
  const [open, setOpen] = useState(false);

  const showConfiguration = useCallback(() => {
    setOpen(true);
  }, []);

  const dismissConfiguration = useCallback(() => {
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    // @todo check copy
    return (
      <Drawer
        onClose={dismissConfiguration}
        title="Alertmanager name here"
        subtitle="This is the Alertmanager configuration"
        size="lg"
      >
        <AlertmanagerConfig alertmanagerName={'grafana'} onDismiss={dismissConfiguration} />
      </Drawer>
    );
  }, [dismissConfiguration, open]);

  return [drawer, showConfiguration, dismissConfiguration];
}
