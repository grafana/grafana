import React from 'react';

import { ExplorePanelProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Collapse } from '@grafana/ui';
// // TODO: probably needs to be exported from ui directly
import { FilterItem, FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/src/components/Table/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Based on visulastionType search existing registered panels and return matching one.
 */
export async function getPanelForVisType(visType: string): Promise<React.ComponentType<ExplorePanelProps>> {
  // For some visualisation we still may have hardcoded values/components for some time. Later we may try to figure
  // out a good way to override them with custom panels.
  switch (visType) {
    case 'graph': {
      return GraphPanel;
    }
    case 'table': {
      return TablePanel;
    }

    case 'nodeGraph': {
      return NodeGraphPanel;
    }

    case 'logs': {
      return LogsPanel;
    }

    case 'trace': {
      return TraceViewPanel;
    }
    default: {
      const panels = getAllPanelPluginMeta();
      for (const panel of panels) {
        const panelPlugin = await importPanelPlugin(panel.id);
        // Check each panel and see if it is correct type for the data.
        if (panelPlugin.visualisationType?.includes(visType)) {
          // If there is explorePanel component use that.
          if (panelPlugin.explorePanel) {
            return panelPlugin.explorePanel;
          } else {
            return makePanelExploreCompatible(panelPlugin.panel);
          }
        }
      }

      // Probably ok fallback but maybe it makes sense to throw or show some info message that we did not find anything
      // better.
      return TablePanel;
    }
  }
}

/**
 * Wrap panel adding a transform so we can use dashboard panels Explore without modification.
 * @param Panel
 */
function makePanelExploreCompatible(Panel: ComponentType<PanelProps<TOptions>>) {
  return function CompatibilityWrapper(props: ExplorePanelProps) {
    // This transform may not be 100% perfect so we may need to use some sensible zero/empty/noop values. We will have
    // to see how much impact that will have but I would think even if that makes some panels loose some functionality
    // it may be still ok. If there are bugs we will have to fix them somehow.
    const dashboardProps = transformToDasboardProps(props)
    return <Panel {...dashboardProps}/>
  }
}
