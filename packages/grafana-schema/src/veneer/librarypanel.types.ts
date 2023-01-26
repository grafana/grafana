import * as raw from '../raw/librarypanel/x/librarypanel_types.gen';

import { Panel } from './dashboard.types';

export interface LibraryPanel extends raw.LibraryPanel {
  model: Panel;
}

export const defaultLibraryPanel = raw.defaultLibraryPanel;
