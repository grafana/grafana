import { LazyAddPanelToNotebookModalBody } from 'app/features/notebook/addPanel/LazyAddPanelToNotebookModalBody';
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
 */
export function ExploreToNotebookPanel({ exploreId, onClose }: Props) {
  const exploreItem = useSelector(getExploreItemSelector(exploreId))!;

  const buildPanel = () =>
    buildPanelElementFromExplore({
      datasource: exploreItem.datasourceInstance?.getRef(),
      queries: exploreItem.queries,
      queryResponse: exploreItem.queryResponse,
      panelState: exploreItem.panelsState,
    });

  return <LazyAddPanelToNotebookModalBody buildPanel={buildPanel} onDismiss={onClose} />;
}
