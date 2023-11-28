import { reportInteraction } from '@grafana/runtime';
export const GENERATE_AI_INTERACTION_EVENT_NAME = 'dashboards_autogenerate_clicked';
// Source of the interaction
export var EventTrackingSrc;
(function (EventTrackingSrc) {
    EventTrackingSrc["panelDescription"] = "panel-description";
    EventTrackingSrc["panelTitle"] = "panel-title";
    EventTrackingSrc["dashboardChanges"] = "dashboard-changes";
    EventTrackingSrc["dashboardTitle"] = "dashboard-title";
    EventTrackingSrc["dashboardDescription"] = "dashboard-description";
    EventTrackingSrc["unknown"] = "unknown";
})(EventTrackingSrc || (EventTrackingSrc = {}));
// Item of the interaction for the improve button and history poppover
export var AutoGenerateItem;
(function (AutoGenerateItem) {
    AutoGenerateItem["autoGenerateButton"] = "auto-generate-button";
    AutoGenerateItem["erroredRetryButton"] = "errored-retry-button";
    AutoGenerateItem["improveButton"] = "improve-button";
    AutoGenerateItem["backHistoryItem"] = "back-history-item";
    AutoGenerateItem["forwardHistoryItem"] = "forward-history-item";
    AutoGenerateItem["quickFeedback"] = "quick-feedback";
    AutoGenerateItem["linkToDocs"] = "link-to-docs";
    AutoGenerateItem["customFeedback"] = "custom-feedback";
    AutoGenerateItem["applySuggestion"] = "apply-suggestion";
})(AutoGenerateItem || (AutoGenerateItem = {}));
export function reportAutoGenerateInteraction(src, item, otherMeta) {
    reportInteraction(GENERATE_AI_INTERACTION_EVENT_NAME, Object.assign({ src, item }, otherMeta));
}
//# sourceMappingURL=tracking.js.map