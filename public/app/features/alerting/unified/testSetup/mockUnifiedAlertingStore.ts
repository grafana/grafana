import { configureStore } from 'app/store/configureStore';
import { type StoreState } from 'app/types/store';

export function mockUnifiedAlertingStore(unifiedAlerting?: Partial<StoreState['unifiedAlerting']>) {
  const defaultState = configureStore().getState();

  return configureStore({
    ...defaultState,
    unifiedAlerting: {
      ...defaultState.unifiedAlerting,
      ...unifiedAlerting,
    },
  });
}
