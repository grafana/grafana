import { reportInteraction } from '@grafana/runtime';

export const GENERATE_AI_INTERACTION_EVENT_NAME = 'dashboards_autogenerate_clicked';

// Source of the interaction
export enum EventTrackingSrc {
  panelDescription = 'panel-description',
  panelTitle = 'panel-title',
  dashboardChanges = 'dashboard-changes',
  dashboardTitle = 'dashboard-title',
  dashboardDescription = 'dashboard-description',
  sqlExpressions = 'sql-expressions',
  unknown = 'unknown',
}

// Item of the interaction for the improve button and history poppover
export enum AutoGenerateItem {
  autoGenerateButton = 'auto-generate-button',
  erroredRetryButton = 'errored-retry-button',
  stopGenerationButton = 'stop-generating-button',
  improveButton = 'improve-button',
  backHistoryItem = 'back-history-item',
  forwardHistoryItem = 'forward-history-item',
  quickFeedback = 'quick-feedback',
  linkToDocs = 'link-to-docs',
  customFeedback = 'custom-feedback',
  applySuggestion = 'apply-suggestion',
}

export function reportAutoGenerateInteraction(src: EventTrackingSrc, item: AutoGenerateItem, otherMeta?: object) {
  reportInteraction(GENERATE_AI_INTERACTION_EVENT_NAME, { src, item, ...otherMeta });
}
