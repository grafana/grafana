import { map } from 'lodash';
import React, { useEffect, useState, memo } from 'react';
import { textUtil, rangeUtil } from '@grafana/data';
import { getPrometheusTime } from '../language_utils';
const PromLink = ({ panelData, query, datasource }) => {
    const [href, setHref] = useState('');
    useEffect(() => {
        if (panelData) {
            const getExternalLink = () => {
                if (!panelData.request) {
                    return '';
                }
                const { request: { range, interval, scopedVars }, } = panelData;
                const start = getPrometheusTime(range.from, false);
                const end = getPrometheusTime(range.to, true);
                const rangeDiff = Math.ceil(end - start);
                const endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
                const enrichedScopedVars = Object.assign(Object.assign({}, scopedVars), datasource.getRateIntervalScopedVariable(rangeUtil.intervalToSeconds(interval), rangeUtil.intervalToSeconds(datasource.interval)));
                const options = {
                    interval,
                    scopedVars: enrichedScopedVars,
                };
                const customQueryParameters = {};
                if (datasource.customQueryParameters) {
                    for (const [k, v] of datasource.customQueryParameters) {
                        customQueryParameters[k] = v;
                    }
                }
                const queryOptions = datasource.createQuery(query, options, start, end);
                const expr = Object.assign(Object.assign({}, customQueryParameters), { 'g0.expr': queryOptions.expr, 'g0.range_input': rangeDiff + 's', 'g0.end_input': endTime, 'g0.step_input': queryOptions.step, 'g0.tab': 0 });
                const args = map(expr, (v, k) => {
                    return k + '=' + encodeURIComponent(v);
                }).join('&');
                return `${datasource.directUrl}/graph?${args}`;
            };
            setHref(getExternalLink());
        }
    }, [datasource, panelData, query]);
    return (React.createElement("a", { href: textUtil.sanitizeUrl(href), target: "_blank", rel: "noopener noreferrer" }, "Prometheus"));
};
export default memo(PromLink);
//# sourceMappingURL=PromLink.js.map