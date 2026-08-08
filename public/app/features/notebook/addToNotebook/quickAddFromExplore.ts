import { t } from '@grafana/i18n';
import { buildDashboardPanelFromExploreState } from 'app/features/explore/extensions/AddToDashboard/addToDashboard';
import { getExploreItemSelector } from 'app/features/explore/state/selectors';
import { getState } from 'app/store/store';

import { legacyPanelToNotebookPanel } from './legacyPanelToNotebookPanel';
import { quickAddToLastNotebook } from './quickAddToLastNotebook';

/**
 * Explore toolbar → "Add to last notebook": captures the current query/visualization
 * (same panel builder as the modal flow) and appends it to the most recently used
 * notebook in one click. Returns false when there is no last notebook to add to.
 */
export async function quickAddExploreToLastNotebook(exploreId: string): Promise<boolean> {
  const exploreItem = getExploreItemSelector(exploreId)(getState());
  if (!exploreItem) {
    return false;
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

  return quickAddToLastNotebook(element, { timeRange: exploreItem.range.raw });
}
