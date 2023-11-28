import { __rest } from "tslib";
import { reportInteraction } from '@grafana/runtime';
export const reportDashboardListViewed = (eventTrackingNamespace, query) => {
    reportInteraction(`${eventTrackingNamespace}_viewed`, getQuerySearchContext(query));
};
export const reportSearchResultInteraction = (eventTrackingNamespace, query) => {
    reportInteraction(`${eventTrackingNamespace}_result_clicked`, getQuerySearchContext(query));
};
export const reportSearchQueryInteraction = (eventTrackingNamespace, query) => {
    reportInteraction(`${eventTrackingNamespace}_query_submitted`, getQuerySearchContext(query));
};
export const reportSearchFailedQueryInteraction = (eventTrackingNamespace, _a) => {
    var { error } = _a, query = __rest(_a, ["error"]);
    reportInteraction(`${eventTrackingNamespace}_query_failed`, Object.assign(Object.assign({}, getQuerySearchContext(query)), { error }));
};
export const reportPanelInspectInteraction = (PanelInspectType, name, properties) => {
    reportInteraction(`grafana_panel_inspect_${PanelInspectType}_${name}_clicked`, properties);
};
const getQuerySearchContext = (query) => {
    var _a, _b, _c, _d, _e, _f;
    return {
        layout: query.layout,
        starredFilter: (_a = query.starred) !== null && _a !== void 0 ? _a : false,
        sort: (_b = query.sortValue) !== null && _b !== void 0 ? _b : '',
        tagCount: (_c = query.tagCount) !== null && _c !== void 0 ? _c : 0,
        queryLength: (_e = (_d = query.query) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0,
        includePanels: (_f = query.includePanels) !== null && _f !== void 0 ? _f : false,
    };
};
//# sourceMappingURL=reporting.js.map