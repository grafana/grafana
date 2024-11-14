import { PanelModel } from '../dashboard/state';

import { PanelModelWithLibraryPanel } from './types';

export function isPanelModelLibraryPanel(panel: PanelModel): panel is PanelModelWithLibraryPanel {
  return Boolean(panel.libraryPanel?.uid);
}
