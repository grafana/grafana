import { defineFeatureEvents } from '@grafana/runtime/unstable';

import {
  type RecommendationsShown,
  type ClearHistoryClicked,
  type CtaClicked,
  type SolutionFilterChanged,
  type TabChanged,
} from './types';

const createHomepageEvent = defineFeatureEvents('grafana', 'homepage');

/** Fired when the user clicks a tab on the homepage. */
export const tabChanged = createHomepageEvent<TabChanged>('tab_changed');

/** Fired when the user is shown recommendations on the homepage. */
export const recommendationsShown = createHomepageEvent<RecommendationsShown>('recommendations_shown');

/** Fired when the user clears their recently-viewed dashboard history. */
export const clearHistoryClicked = createHomepageEvent<ClearHistoryClicked>('clear_history_clicked');

/**
 * Fired when the user clicks a tracked call-to-action on a homepage widget.
 * Coverage is the surfaces/actions enumerated in CtaClicked, not every homepage link.
 */
export const ctaClicked = createHomepageEvent<CtaClicked>('cta_clicked');

/** Fired when the user saves or clears a solution card's scope in its filter dialog. */
export const solutionFilterChanged = createHomepageEvent<SolutionFilterChanged>('solution_filter_changed');

/** Fired once when the homepage content first renders (never while a loading skeleton is showing). */
export const homepageViewed = createHomepageEvent('viewed');
