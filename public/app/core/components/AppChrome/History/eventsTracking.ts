import { reportInteraction } from '@grafana/runtime';

const UNIFIED_HISTORY_ENTRY_CLICKED = 'grafana_unified_history_entry_clicked';
const UNIFIED_HISTORY_ENTRY_DUPLICATED = 'grafana_unified_history_duplicated_entry_rendered';
const UNIFIED_HISTORY_DRAWER_INTERACTION = 'grafana_unified_history_drawer_interaction';
const UNIFIED_HISTORY_DRAWER_SHOW_MORE = 'grafana_unified_history_show_more';

//Currently just 'timeRange' is supported
//in short term, we could add 'templateVariables' for example
type subEntryTypes = 'timeRange';

//Whether the user opens or closes the `HistoryDrawer`
type UnifiedHistoryDrawerInteraction = 'open' | 'close';

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

//Event triggered when a user clicks on an entry of the `HistoryDrawer`
export const logClickUnifiedHistoryEntryEvent = ({ entryURL, subEntry }: UnifiedHistoryEntryClicked) => {
  reportInteraction(UNIFIED_HISTORY_ENTRY_CLICKED, {
    entryURL,
    subEntry,
  });
};

//Event triggered when history entry name matches the previous one
//so we keep track of duplicated entries and be able to analyze them
export const logDuplicateUnifiedHistoryEntryEvent = ({
  entryName,
  lastEntryURL,
  newEntryURL,
}: UnifiedHistoryEntryDuplicated) => {
  reportInteraction(UNIFIED_HISTORY_ENTRY_DUPLICATED, {
    entryName,
    lastEntryURL,
    newEntryURL,
  });
};

//We keep track of users open and closing the drawer
export const logUnifiedHistoryDrawerInteractionEvent = ({ type }: { type: UnifiedHistoryDrawerInteraction }) => {
  reportInteraction(UNIFIED_HISTORY_DRAWER_INTERACTION, {
    type,
  });
};

//We keep track of users clicking on the `Show more` button
export const logUnifiedHistoryShowMoreEvent = () => {
  reportInteraction(UNIFIED_HISTORY_DRAWER_SHOW_MORE);
};
