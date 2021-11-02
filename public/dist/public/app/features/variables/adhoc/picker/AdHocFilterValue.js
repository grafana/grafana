import { __awaiter, __generator } from "tslib";
import React from 'react';
import { SegmentAsync } from '@grafana/ui';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
export var AdHocFilterValue = function (_a) {
    var datasource = _a.datasource, onChange = _a.onChange, filterKey = _a.filterKey, filterValue = _a.filterValue, placeHolder = _a.placeHolder;
    var loadValues = function () { return fetchFilterValues(datasource, filterKey); };
    return (React.createElement("div", { className: "gf-form" },
        React.createElement(SegmentAsync, { className: "query-segment-value", placeholder: placeHolder, value: filterValue, onChange: onChange, loadOptions: loadValues })));
};
var fetchFilterValues = function (datasource, key) { return __awaiter(void 0, void 0, void 0, function () {
    var ds, metrics;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getDatasourceSrv().get(datasource)];
            case 1:
                ds = _a.sent();
                if (!ds || !ds.getTagValues) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, ds.getTagValues({ key: key })];
            case 2:
                metrics = _a.sent();
                return [2 /*return*/, metrics.map(function (m) { return ({ label: m.text, value: m.text }); })];
        }
    });
}); };
//# sourceMappingURL=AdHocFilterValue.js.map