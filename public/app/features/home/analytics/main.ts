import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type ClearHistoryClicked, type EmptyCtaClicked, type TabChanged } from './types';

const createHomepageEvent = defineFeatureEvents('grafana', 'homepage');

/** Fired when the user clicks a tab on the homepage. */
export const tabChanged = createHomepageEvent<TabChanged>('tab_changed');

/** Fired when the user clears their recently-viewed dashboard history. */
export const clearHistoryClicked = createHomepageEvent<ClearHistoryClicked>('clear_history_clicked');

/** Fired when the user clicks the empty-state call-to-action on the Recent tab. */
export const emptyCtaClicked = createHomepageEvent<EmptyCtaClicked>('empty_cta_clicked');
