import { createEventFactory } from 'app/core/services/echo/Echo';

//Currently just 'timeRange' is supported
//in short term, we could add 'templateVariables' for example
type subEntryTypes = 'timeRange';

//Whether the user opens or closes the `HistoryDrawer`
type UnifiedHistoryDrawerActions = 'open' | 'close';

interface UnifiedHistoryEntryClicked {
  //We will also work with the current URL but we will get this from Rudderstack data
  //URL to return to
  entryURL: string;
  //In the case we want to go back to a specific query param, currently just a specific time range
  subEntry?: subEntryTypes;
}

interface UnifiedHistoryEntryDuplicated {
  // Common name of the history entries
  entryName: string;
  // URL of the last entry
  lastEntryURL: string;
  // URL of the new entry
  newEntryURL: string;
}

interface UnifiedHistoryDrawerInteraction {
  type: UnifiedHistoryDrawerActions;
}

const createUnifiedHistoryEvent = createEventFactory('grafana', 'unified_history');

/**
 * Event triggered when a user clicks on an entry of the `HistoryDrawer`
 * @owner grafana-frontend-platform
 */
//@ts-expect-error
export const logClickUnifiedHistoryEntryEvent = createUnifiedHistoryEvent<UnifiedHistoryEntryClicked>('entry_clicked');

/**
 * Event triggered when history entry name matches the previous one
 * so we keep track of duplicated entries and be able to analyze them
 * @owner grafana-frontend-platform
 */
export const logDuplicateUnifiedHistoryEntryEvent =
  //@ts-expect-error
  createUnifiedHistoryEvent<UnifiedHistoryEntryDuplicated>('duplicated_entry_rendered');

/** We keep track of users open and closing the drawer
 * @owner grafana-frontend-platform
 */
export const logUnifiedHistoryDrawerInteractionEvent =
  //@ts-expect-error
  createUnifiedHistoryEvent<UnifiedHistoryDrawerInteraction>('drawer_interaction');

/**We keep track of users clicking on the `Show more` button
 * @owner grafana-frontend-platform
 */
export const logUnifiedHistoryShowMoreEvent = createUnifiedHistoryEvent('show_more');
