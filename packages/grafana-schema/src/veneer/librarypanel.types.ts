import * as raw from '../raw/librarypanel/x/librarypanel_types.gen';

import { Panel } from './dashboard.types';

export interface LibraryPanel extends raw.LibraryPanel {
  model: Omit<Panel, 'gridPos' | 'id' | 'libraryPanel'>;
}
