import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import { quickAddPanelToNotebook } from 'app/features/notebook/addPanel/quickAddPanelToNotebook';
import { NOTEBOOK_ENTRY_POINT } from 'app/features/notebook/analytics/types';
import { getState } from 'app/store/store';

export async function quickAddFromExplore(exploreId: string, openPicker: () => void): Promise<void> {
  const exploreItem = getState().explore?.panes[exploreId];
  if (!exploreItem) {
    openPicker();
    return;
  }

  await quickAddPanelToNotebook(
    async () =>
      buildPanelElementFromExplore({
        datasource: exploreItem.datasourceInstance?.getRef(),
        queries: exploreItem.queries,
        queryResponse: exploreItem.queryResponse,
        panelState: exploreItem.panelsState,
      }),
    NOTEBOOK_ENTRY_POINT.EXPLORE,
    false,
    openPicker,
    exploreId
  );
}
