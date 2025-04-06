import { ToolbarButton } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { ToolbarActionProps } from '../types';

export function KioskToggleButton({ dashboard }: ToolbarActionProps) {
  const { chrome } = useGrafana();

  return <ToolbarButton icon="monitor" onClick={chrome.onToggleKioskMode} tooltip="Enable kiosk mode" />;
}
