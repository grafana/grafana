import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';
import { InspectStatsTable } from './InspectStatsTable';
import { InspectStatsTraceIdsTable } from './InspectStatsTraceIdsTable';
export const InspectStatsTab = ({ data, timeZone }) => {
    var _a, _b, _c, _d;
    if (!data.request) {
        return null;
    }
    let stats = [];
    const requestTime = data.request.endTime ? data.request.endTime - data.request.startTime : -1;
    const processingTime = ((_a = data.timings) === null || _a === void 0 ? void 0 : _a.dataProcessingTime) || -1;
    let dataRows = 0;
    for (const frame of data.series) {
        dataRows += frame.length;
    }
    if (requestTime > 0) {
        stats.push({
            displayName: t('dashboard.inspect-stats.request-time', 'Total request time'),
            value: requestTime,
            unit: 'ms',
        });
    }
    if (processingTime > 0) {
        stats.push({
            displayName: t('dashboard.inspect-stats.processing-time', 'Data processing time'),
            value: processingTime,
            unit: 'ms',
        });
    }
    stats.push({
        displayName: t('dashboard.inspect-stats.queries', 'Number of queries'),
        value: (_c = (_b = data.request.targets) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0,
    });
    stats.push({
        displayName: t('dashboard.inspect-stats.rows', 'Total number rows'),
        value: dataRows,
    });
    let dataStats = [];
    for (const series of data.series) {
        if (series.meta && series.meta.stats) {
            dataStats = dataStats.concat(series.meta.stats);
        }
    }
    const statsTableName = t('dashboard.inspect-stats.table-title', 'Stats');
    const dataStatsTableName = t('dashboard.inspect-stats.data-title', 'Data source stats');
    const traceIdsStatsTableName = t('dashboard.inspect-stats.data-traceids', 'Trace IDs');
    return (React.createElement("div", { "aria-label": selectors.components.PanelInspector.Stats.content, className: containerStyles },
        React.createElement(InspectStatsTable, { timeZone: timeZone, name: statsTableName, stats: stats }),
        React.createElement(InspectStatsTable, { timeZone: timeZone, name: dataStatsTableName, stats: dataStats }),
        React.createElement(InspectStatsTraceIdsTable, { name: traceIdsStatsTableName, traceIds: (_d = data.traceIds) !== null && _d !== void 0 ? _d : [] })));
};
const containerStyles = css `
  height: 100%;
  overflow-y: scroll;
`;
//# sourceMappingURL=InspectStatsTab.js.map