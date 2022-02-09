import { StoreState } from 'app/types';
import { useSelector } from 'react-redux';
import { UnifiedAlertingState } from '../state/reducers';

export function useUnifiedAlertingSelector<TSelected = unknown>(
  selector: (state: UnifiedAlertingState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
): TSelected {
  return useSelector((state: StoreState) => selector(state.unifiedAlerting), equalityFn);
}
