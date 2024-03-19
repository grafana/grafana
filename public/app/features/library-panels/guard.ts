import { PanelModel } from '@grafana/data';

import { PanelModel as LegacyPanelModel } from '../dashboard/state';

import { PanelModelWithLibraryPanel } from './types';

export function isPanelModelLibraryPanel(panel: LegacyPanelModel): panel is PanelModelWithLibraryPanel {
  return Boolean(panel.libraryPanel?.uid);
}

export function isPanelModelLibraryPanel2(panel: PanelModel): panel is PanelModelWithLibraryPanel {
  return Boolean(panel.libraryPanel?.uid);
}
