import { createSelector } from 'reselect';

import { type StoreState, useSelector } from 'app/types/store';

import { type UnifiedAlertingState } from '../state/reducers';

/**
 * @deprecated: DO NOT USE THIS; when using this you are INCORRECTLY assuming that we already have dispatched an action to populate the redux store values
 */
export function useUnifiedAlertingSelector<TSelected = unknown>(
  selector: (state: UnifiedAlertingState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
): TSelected {
  return useSelector(
    createSelector(
      (state: StoreState) => state.unifiedAlerting,
      (unifiedAlerting) => selector(unifiedAlerting)
    ),
    equalityFn
  );
}
