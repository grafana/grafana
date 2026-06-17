import { type VizPanel } from '@grafana/scenes';
import { getLibraryPanelBehavior } from 'app/features/dashboard-scene/utils/getLibraryPanelBehavior';

export function isLibraryPanel(vizPanel: VizPanel): boolean {
  return getLibraryPanelBehavior(vizPanel) !== undefined;
}
