import { css } from '@emotion/css';
import React from 'react';
import { FieldType, formattedValueToString, getDisplayProcessor, } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';
export const InspectStatsTable = ({ timeZone, name, stats }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    if (!stats || !stats.length) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: "section-heading" }, name),
        React.createElement("table", { className: "filter-table width-30" },
            React.createElement("tbody", null, stats.map((stat, index) => {
                return (React.createElement("tr", { key: `${stat.displayName}-${index}` },
                    React.createElement("td", null, stat.displayName),
                    React.createElement("td", { className: styles.cell }, formatStat(stat, timeZone, theme))));
            })))));
};
function formatStat(stat, timeZone, theme) {
    const display = getDisplayProcessor({
        field: {
            type: FieldType.number,
            config: stat,
        },
        theme,
        timeZone,
    });
    return formattedValueToString(display(stat.value));
}
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
//# sourceMappingURL=InspectStatsTable.js.map