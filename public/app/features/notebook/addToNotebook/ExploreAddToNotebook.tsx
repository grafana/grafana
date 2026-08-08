import { t } from '@grafana/i18n';
import { buildDashboardPanelFromExploreState } from 'app/features/explore/extensions/AddToDashboard/addToDashboard';
import { getExploreItemSelector } from 'app/features/explore/state/selectors';
import { useSelector } from 'app/types/store';

import { AddToNotebookForm } from './AddToNotebookForm';
import { legacyPanelToNotebookPanel } from './legacyPanelToNotebookPanel';

interface Props {
  exploreId: string;
  onClose: () => void;
}

/**
 * Explore toolbar → "Add to notebook": reuses the add-to-dashboard panel builder
 * (queries + datasource + panel type inferred from the response frames) and
 * converts the result into a notebook panel element.
 */
export function ExploreAddToNotebook({ exploreId, onClose }: Props) {
  const exploreItem = useSelector(getExploreItemSelector(exploreId));

  if (!exploreItem) {
    return null;
  }

  const legacyPanel = buildDashboardPanelFromExploreState({
    datasource: exploreItem.datasourceInstance?.getRef(),
    queries: exploreItem.queries,
    queryResponse: exploreItem.queryResponse,
    panelState: exploreItem.panelsState,
  });

  const element = legacyPanelToNotebookPanel(legacyPanel, {
    title: t('notebooks.add-from-explore.panel-title', 'Explore query'),
    subtitle: t('notebooks.add-from-explore.origin', 'From Explore ({{datasource}})', {
      datasource: exploreItem.datasourceInstance?.name ?? '',
    }),
  });

  return (
    <AddToNotebookForm
      element={element}
      sourceName={t('notebooks.add-from-explore.source', 'Explore')}
      timeRange={exploreItem.range.raw}
      onDismiss={onClose}
    />
  );
}
