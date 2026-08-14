import { AddPanelToNotebookModalBody } from 'app/features/notebook/addPanel/AddPanelToNotebookModalBody';
import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { useSelector } from 'app/types/store';

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

  // Async only to match the shared modal's contract; Explore has no variables to interpolate.
  const buildPanel = async () =>
    buildPanelElementFromExplore({
      datasource: exploreItem.datasourceInstance?.getRef(),
      queries: exploreItem.queries,
      queryResponse: exploreItem.queryResponse,
      panelState: exploreItem.panelsState,
    });

  return <AddPanelToNotebookModalBody buildPanel={buildPanel} onDismiss={onClose} />;
}
