import React from 'react';

import { ToolbarButton } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

export function ExtensionDrawerButton() {
  const { chrome } = useGrafana();
  return (
    <ToolbarButton iconOnly icon="bars" aria-label="Extensions" onClick={() => chrome.setExtensionDrawerOpen(true)} />
  );
}
