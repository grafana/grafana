import { __values } from "tslib";
import { selectors } from '@grafana/e2e-selectors';
import { InspectStatsTable } from './InspectStatsTable';
import React from 'react';
export var InspectStatsTab = function (_a) {
    var e_1, _b, e_2, _c;
    var _d;
    var data = _a.data, timeZone = _a.timeZone;
    if (!data.request) {
        return null;
    }
    var stats = [];
    var requestTime = data.request.endTime ? data.request.endTime - data.request.startTime : -1;
    var processingTime = ((_d = data.timings) === null || _d === void 0 ? void 0 : _d.dataProcessingTime) || -1;
    var dataRows = 0;
    try {
        for (var _e = __values(data.series), _f = _e.next(); !_f.done; _f = _e.next()) {
            var frame = _f.value;
            dataRows += frame.length;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (requestTime > 0) {
        stats.push({ displayName: 'Total request time', value: requestTime, unit: 'ms' });
    }
    if (processingTime > 0) {
        stats.push({ displayName: 'Data processing time', value: processingTime, unit: 'ms' });
    }
    stats.push({ displayName: 'Number of queries', value: data.request.targets.length });
    stats.push({ displayName: 'Total number rows', value: dataRows });
    var dataStats = [];
    try {
        for (var _g = __values(data.series), _h = _g.next(); !_h.done; _h = _g.next()) {
            var series = _h.value;
            if (series.meta && series.meta.stats) {
                dataStats = dataStats.concat(series.meta.stats);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_h && !_h.done && (_c = _g.return)) _c.call(_g);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return (React.createElement("div", { "aria-label": selectors.components.PanelInspector.Stats.content },
        React.createElement(InspectStatsTable, { timeZone: timeZone, name: 'Stats', stats: stats }),
        React.createElement(InspectStatsTable, { timeZone: timeZone, name: 'Data source stats', stats: dataStats })));
};
//# sourceMappingURL=InspectStatsTab.js.map