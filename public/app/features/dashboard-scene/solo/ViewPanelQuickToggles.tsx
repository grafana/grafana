import { useMemo } from 'react';

import { type PanelPlugin } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';

export interface Props {
  panel: VizPanel;
  plugin: PanelPlugin;
}

export function ViewPanelQuickToggles({ panel, plugin }: Props) {
  const category = useMemo(() => {
    const quickToggles = plugin.viewPanelOptions?.quickToggles;
    if (!quickToggles) {
      return null;
    }

    const categories = getVisualizationOptions2({
      panel,
      plugin,
      eventBus: panel.getPanelContext().eventBus,
      instanceState: panel.getPanelContext().instanceState,
      quickToggles: true,
    });

    if (categories.length === 0) {
      return null;
    }

    return categories[0];
  }, [panel, plugin]);

  if (!category) {
    return null;
  }

  return category.renderElement();
}
