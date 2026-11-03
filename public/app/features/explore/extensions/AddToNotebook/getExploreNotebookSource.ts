import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { type TimeZone } from '@grafana/schema';
import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { captureTimeRange } from 'app/features/notebook/addPanel/capturedTimeRange';
import { type ExploreItemState } from 'app/types/explore';

/**
 * What a notebook needs from an Explore pane: the panel to add and the window it was showing. Shared
 * by the picker modal and the one-click "add to open notebook" so they cannot diverge.
 *
 * The time zone is the pane's own, so the captured window is described the way Explore's time picker
 * described it.
 */
export function getExploreNotebookSource(exploreItem: ExploreItemState, timeZone: TimeZone) {
  return {
    buildPanel: async () => {
      // buildPanelElementFromExplore is synchronous and reads the panel metas map.
      await getPanelPluginMetasMap();

      return buildPanelElementFromExplore({
        datasource: exploreItem.datasourceInstance?.getRef(),
        queries: exploreItem.queries,
        queryResponse: exploreItem.queryResponse,
        panelState: exploreItem.panelsState,
      });
    },
    capturedTimeRange: captureTimeRange(exploreItem.range.raw, timeZone),
  };
}
