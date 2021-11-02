/**
 * The meta analytics events that can be added to the echo service.
 *
 * @public
 */
export var MetaAnalyticsEventName;
(function (MetaAnalyticsEventName) {
    MetaAnalyticsEventName["DashboardView"] = "dashboard-view";
    MetaAnalyticsEventName["DataRequest"] = "data-request";
})(MetaAnalyticsEventName || (MetaAnalyticsEventName = {}));
/**
 * Pageview event typeguard.
 *
 * @public
 */
export var isPageviewEvent = function (event) {
    return Boolean(event.payload.page);
};
/**
 * Interaction event typeguard.
 *
 * @public
 */
export var isInteractionEvent = function (event) {
    return Boolean(event.payload.interactionName);
};
//# sourceMappingURL=analytics.js.map