import { AddPanelToNotebookModalBody } from 'app/features/notebook/addPanel/AddPanelToNotebookModalBody';
import { NOTEBOOK_ENTRY_POINT } from 'app/features/notebook/analytics/types';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { useSelector, type StoreState } from 'app/types/store';

import { getExploreItemSelector } from '../../state/selectors';

import { getExploreNotebookSource } from './getExploreNotebookSource';

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
  const timeZone = useSelector((state: StoreState) => getTimeZone(state.user));
  const { buildPanel, capturedTimeRange } = getExploreNotebookSource(exploreItem, timeZone);

  return (
    <AddPanelToNotebookModalBody
      buildPanel={buildPanel}
      onDismiss={onClose}
      entryPoint={NOTEBOOK_ENTRY_POINT.EXPLORE}
      // Explore builds its panel from the pane's queries, so there is no library panel to send.
      isLibraryPanel={false}
      capturedTimeRange={capturedTimeRange}
    />
  );
}
