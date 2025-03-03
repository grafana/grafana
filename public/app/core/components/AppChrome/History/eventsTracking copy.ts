import { createEventFactory as cef, TrackingEventProps } from '../../../services/echo/Echo';

/**
 * Testing file for developing the analytics report. It tests:
 *  - it can track an aliased import
 *  - it works with a relative import
 *  - it can track multiple namespaces in the same file
 */

//Whether the user opens or closes the `HistoryDrawer`
type UnifiedHistoryDrawerActions = 'open' | 'close';

interface UnifiedHistoryEntryDuplicated extends TrackingEventProps {
  // Common name of the history entries
  entryName: string;
  // URL of the last entry
  lastEntryURL: string;
  // URL of the new entry
  newEntryURL: string;
}

interface UnifiedHistoryDrawerInteraction extends TrackingEventProps {
  type: UnifiedHistoryDrawerActions;
}

const createFeatureA = cef('grafana', 'feature_a');
const createFeatureB = cef('grafana', 'feature_b');

/** Foo description */
export const logFoo = createFeatureA<UnifiedHistoryDrawerInteraction>('click_A');

/** Bar description */
export const logBar = createFeatureB<UnifiedHistoryEntryDuplicated>('click_B');
