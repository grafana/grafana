// @todo: replace barrel import path
import { PanelModel } from '../dashboard/state/index';

import { PanelModelWithLibraryPanel } from './types';

export function isPanelModelLibraryPanel(panel: PanelModel): panel is PanelModelWithLibraryPanel {
  return Boolean(panel.libraryPanel?.uid);
}
