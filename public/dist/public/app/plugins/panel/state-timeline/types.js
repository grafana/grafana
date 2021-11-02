import { VisibilityMode } from '@grafana/schema';
/**
 * @alpha
 */
export var defaultPanelOptions = {
    showValue: VisibilityMode.Auto,
    alignValue: 'left',
    mergeValues: true,
    rowHeight: 0.9,
};
/**
 * @alpha
 */
export var defaultTimelineFieldConfig = {
    lineWidth: 0,
    fillOpacity: 70,
};
/**
 * @alpha
 */
export var TimelineMode;
(function (TimelineMode) {
    // state-timeline
    TimelineMode["Changes"] = "changes";
    // status-history
    TimelineMode["Samples"] = "samples";
})(TimelineMode || (TimelineMode = {}));
//# sourceMappingURL=types.js.map