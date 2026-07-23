import { defineFeatureEvents } from '@grafana/runtime/unstable';

import {
  type AlertsCardClicked,
  type ClearHistoryClicked,
  type EmptyCtaClicked,
  type IncidentsCardClicked,
  type NoDataCtaClicked,
  type RecommendationEnableClicked,
  type TabChanged,
} from './types';

const createHomepageEvent = defineFeatureEvents('grafana', 'homepage');

/** Fired when the user clicks a tab on the homepage. */
export const tabChanged = createHomepageEvent<TabChanged>('tab_changed');

/** Fired when the user clears their recently-viewed dashboard history. */
export const clearHistoryClicked = createHomepageEvent<ClearHistoryClicked>('clear_history_clicked');

/** Fired when the user clicks the empty-state call-to-action on the Recent tab. */
export const emptyCtaClicked = createHomepageEvent<EmptyCtaClicked>('empty_cta_clicked');

/** Fired when the user clicks the Enable CTA on a homepage recommendation card. */
export const recommendationEnableClicked = createHomepageEvent<RecommendationEnableClicked>(
  'recommendation_enable_clicked'
);

/** Fired when the user clicks any CTA on the no-data recommendation card. */
export const noDataCtaClicked = createHomepageEvent<NoDataCtaClicked>('no_data_cta_clicked');

/** Fired when the user clicks any control on the homepage Firing alerts card. */
export const alertsCardClicked = createHomepageEvent<AlertsCardClicked>('alerts_card_clicked');

/** Fired when the user clicks any control on the homepage Active incidents card. */
export const incidentsCardClicked = createHomepageEvent<IncidentsCardClicked>('incidents_card_clicked');
