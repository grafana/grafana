import { buildPanelElementFromExplore } from 'app/features/notebook/addPanel/buildPanelElementFromExplore';
import {
  captureTimeRange,
  shouldLockCapturedTimeRange,
  withCapturedTimeRange,
} from 'app/features/notebook/addPanel/capturedTimeRange';
import { quickAddPanelToNotebook } from 'app/features/notebook/addPanel/quickAddPanelToNotebook';
import { NOTEBOOK_ENTRY_POINT } from 'app/features/notebook/analytics/types';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getState } from 'app/store/store';

export async function quickAddFromExplore(exploreId: string, openPicker: () => void): Promise<void> {
  const state = getState();
  const exploreItem = state.explore?.panes[exploreId];
  if (!exploreItem) {
    openPicker();
    return;
  }

  const capturedTimeRange = captureTimeRange(exploreItem.range.raw, getTimeZone(state.user));
  const lockTimeRange = shouldLockCapturedTimeRange(capturedTimeRange);

  await quickAddPanelToNotebook(
    async () => {
      const built = buildPanelElementFromExplore({
        datasource: exploreItem.datasourceInstance?.getRef(),
        queries: exploreItem.queries,
        queryResponse: exploreItem.queryResponse,
        panelState: exploreItem.panelsState,
      });
      return lockTimeRange ? withCapturedTimeRange(built, capturedTimeRange) : built;
    },
    NOTEBOOK_ENTRY_POINT.EXPLORE,
    false,
    openPicker,
    exploreId
  );
}
