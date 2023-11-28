import { css } from '@emotion/css';
import React from 'react';
import { stylesFactory, useTheme2 } from '@grafana/ui';
export const InspectStatsTraceIdsTable = ({ name, traceIds }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    if (traceIds.length === 0) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: "section-heading" }, name),
        React.createElement("table", { className: "filter-table width-30" },
            React.createElement("tbody", null, traceIds.map((traceId, index) => {
                return (React.createElement("tr", { key: `${traceId}-${index}` },
                    React.createElement("td", null, traceId)));
            })))));
};
const getStyles = stylesFactory((theme) => {
    return {
        wrapper: css `
      padding-bottom: ${theme.spacing(2)};
    `,
        cell: css `
      text-align: right;
    `,
    };
});
//# sourceMappingURL=InspectStatsTraceIdsTable.js.map