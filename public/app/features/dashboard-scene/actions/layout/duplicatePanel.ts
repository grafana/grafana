import { type VizPanel } from '@grafana/scenes';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';

import { duplicateAutoGridPanel } from './duplicateAutoGridPanel';
import { duplicateDefaultGridPanel } from './duplicateDefaultGridPanel';

export function duplicatePanel(panel: VizPanel) {
  const layout = getLayoutManagerFor(panel);
  if (layout instanceof DefaultGridLayoutManager) {
    duplicateDefaultGridPanel(layout, panel);
  } else if (layout instanceof AutoGridLayoutManager) {
    duplicateAutoGridPanel(layout, panel);
  }
}
