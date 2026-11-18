import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { AddPanelToNotebookModalBody } from 'app/features/notebook/addPanel/AddPanelToNotebookModalBody';
import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { captureTimeRange } from 'app/features/notebook/addPanel/capturedTimeRange';
import { NOTEBOOK_ENTRY_POINT } from 'app/features/notebook/analytics/types';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { useSelector, type StoreState } from 'app/types/store';

import { getExploreItemSelector } from '../../state/selectors';

interface Props {
  exploreId: string;
  onClose: () => void;
}

/**
 * Explore's half of the notebook picker: it supplies the panel, the shared modal body does the rest.
 * Mirrors ExploreToDashboardPanel next door, which does the same for dashboards.
 *
 * Imports the picker and the panel builder directly — this whole module is behind the lazy boundary
 * in getExploreExtensionConfigs, which is what keeps them out of the main bundle.
 */
export function ExploreToNotebookPanel({ exploreId, onClose }: Props) {
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;
  // The pane's own time zone, so the captured window is described to the user the way Explore's
  // time picker described it.
  const timeZone = useSelector((state: StoreState) => getTimeZone(state.user));

  const buildPanel = async () => {
    // buildPanelElementFromExplore is synchronous and reads the panel metas map.
    await getPanelPluginMetasMap();

    return buildPanelElementFromExplore({
      datasource: exploreItem.datasourceInstance?.getRef(),
      queries: exploreItem.queries,
      queryResponse: exploreItem.queryResponse,
      panelState: exploreItem.panelsState,
    });
  };

  return (
    <AddPanelToNotebookModalBody
      buildPanel={buildPanel}
      onDismiss={onClose}
      entryPoint={NOTEBOOK_ENTRY_POINT.EXPLORE}
      // Explore builds its panel from the pane's queries, so there is no library panel to send.
      isLibraryPanel={false}
      capturedTimeRange={captureTimeRange(exploreItem.range.raw, timeZone)}
    />
  );
}
