import { type VizPanel } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';

import { duplicateDefaultGridPanel } from './duplicateDefaultGridPanel';

export function duplicatePanel(panel: VizPanel) {
  const layout = getLayoutManagerFor(panel);
  if (layout instanceof DefaultGridLayoutManager) {
    duplicateDefaultGridPanel(layout, panel);
  } else {
    // TODO: replace with new duplicateAutoGridPanel
    layout.duplicatePanel?.(panel);
  }
}
