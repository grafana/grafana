import { type VizPanel } from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';

export function getLibraryPanelBehavior(vizPanel: VizPanel): LibraryPanelBehavior | undefined {
  const behavior = vizPanel.state.$behaviors?.find((behaviour) => behaviour instanceof LibraryPanelBehavior);

  if (behavior) {
    return behavior;
  }

  return undefined;
}
