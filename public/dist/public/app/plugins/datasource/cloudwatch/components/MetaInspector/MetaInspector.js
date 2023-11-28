import { groupBy } from 'lodash';
import React, { useMemo } from 'react';
// To view: Query Editor in Dashboard -> Query Inspector -> Meta Data
export function MetaInspector({ data = [] }) {
    const rows = useMemo(() => groupBy(data, 'refId'), [data]);
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { className: "filter-table form-inline" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "RefId"),
                    React.createElement("th", null, "Metric Data Query ID"),
                    React.createElement("th", null, "Metric Data Query Expression"),
                    React.createElement("th", null, "Period"),
                    React.createElement("th", null))),
            Object.entries(rows).map(([refId, frames], idx) => {
                var _a, _b;
                if (!frames.length) {
                    return null;
                }
                const frame = frames[0];
                const custom = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom;
                if (!custom) {
                    return null;
                }
                return (React.createElement("tbody", { key: idx },
                    React.createElement("tr", null,
                        React.createElement("td", null, refId),
                        React.createElement("td", null, custom.id),
                        React.createElement("td", null, (_b = frame.meta) === null || _b === void 0 ? void 0 : _b.executedQueryString),
                        React.createElement("td", null, custom.period))));
            }))));
}
//# sourceMappingURL=MetaInspector.js.map