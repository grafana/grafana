import { useSelector } from 'app/types';

import { UnifiedAlertingState } from '../state/reducers';

export function useUnifiedAlertingSelector<TSelected = unknown>(
  selector: (state: UnifiedAlertingState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
): TSelected {
  return useSelector((state) => selector(state.unifiedAlerting), equalityFn);
}
