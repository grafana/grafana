import React from 'react';

import { Drawer } from '@grafana/ui';

interface ConfigurationTrackerDrawerProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle: string;
}

export function ConfigurationTrackerDrawer({ children, onClose, title, subtitle }: ConfigurationTrackerDrawerProps) {
  return (
    <Drawer title={title} subtitle={subtitle} onClose={onClose} size="md">
      {children}
    </Drawer>
  );
}
