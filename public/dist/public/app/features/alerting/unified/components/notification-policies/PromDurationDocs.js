import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { TimeOptions } from '../../types/time';
export function PromDurationDocs() {
    const styles = useStyles2(getPromDurationStyles);
    return (React.createElement("div", null,
        "Prometheus duration format consist of a number followed by a time unit.",
        React.createElement("br", null),
        "Different units can be combined for more granularity.",
        React.createElement("hr", null),
        React.createElement("div", { className: styles.list },
            React.createElement("div", { className: styles.header },
                React.createElement("div", null, "Symbol"),
                React.createElement("div", null, "Time unit"),
                React.createElement("div", null, "Example")),
            React.createElement(PromDurationDocsTimeUnit, { unit: TimeOptions.seconds, name: "seconds", example: "20s" }),
            React.createElement(PromDurationDocsTimeUnit, { unit: TimeOptions.minutes, name: "minutes", example: "10m" }),
            React.createElement(PromDurationDocsTimeUnit, { unit: TimeOptions.hours, name: "hours", example: "4h" }),
            React.createElement(PromDurationDocsTimeUnit, { unit: TimeOptions.days, name: "days", example: "3d" }),
            React.createElement(PromDurationDocsTimeUnit, { unit: TimeOptions.weeks, name: "weeks", example: "2w" }),
            React.createElement("div", { className: styles.examples },
                React.createElement("div", null, "Multiple units combined"),
                React.createElement("code", null, "1m30s, 2h30m20s, 1w2d")))));
}
function PromDurationDocsTimeUnit({ unit, name, example }) {
    const styles = useStyles2(getPromDurationStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.unit }, unit),
        React.createElement("div", null, name),
        React.createElement("code", null, example)));
}
const getPromDurationStyles = (theme) => ({
    unit: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
    list: css `
    display: grid;
    grid-template-columns: max-content 1fr 2fr;
    gap: ${theme.spacing(1, 3)};
  `,
    header: css `
    display: contents;
    font-weight: ${theme.typography.fontWeightBold};
  `,
    examples: css `
    display: contents;
    & > div {
      grid-column: 1 / span 2;
    }
  `,
});
//# sourceMappingURL=PromDurationDocs.js.map