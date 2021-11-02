import { __assign, __read } from "tslib";
import { map } from 'lodash';
import React, { useEffect, useState, memo } from 'react';
import { textUtil, rangeUtil } from '@grafana/data';
var PromLink = function (_a) {
    var panelData = _a.panelData, query = _a.query, datasource = _a.datasource;
    var _b = __read(useState(''), 2), href = _b[0], setHref = _b[1];
    useEffect(function () {
        if (panelData) {
            var getExternalLink = function () {
                if (!panelData.request) {
                    return '';
                }
                var _a = panelData.request, range = _a.range, interval = _a.interval, scopedVars = _a.scopedVars;
                var start = datasource.getPrometheusTime(range.from, false);
                var end = datasource.getPrometheusTime(range.to, true);
                var rangeDiff = Math.ceil(end - start);
                var endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
                var enrichedScopedVars = __assign(__assign({}, scopedVars), datasource.getRateIntervalScopedVariable(rangeUtil.intervalToSeconds(interval), rangeUtil.intervalToSeconds(datasource.interval)));
                var options = {
                    interval: interval,
                    scopedVars: enrichedScopedVars,
                };
                var queryOptions = datasource.createQuery(query, options, start, end);
                var expr = {
                    'g0.expr': queryOptions.expr,
                    'g0.range_input': rangeDiff + 's',
                    'g0.end_input': endTime,
                    'g0.step_input': queryOptions.step,
                    'g0.tab': 0,
                };
                var args = map(expr, function (v, k) {
                    return k + '=' + encodeURIComponent(v);
                }).join('&');
                return datasource.directUrl + "/graph?" + args;
            };
            setHref(getExternalLink());
        }
    }, [datasource, panelData, query]);
    return (React.createElement("a", { href: textUtil.sanitizeUrl(href), target: "_blank", rel: "noopener noreferrer" }, "Prometheus"));
};
export default memo(PromLink);
//# sourceMappingURL=PromLink.js.map