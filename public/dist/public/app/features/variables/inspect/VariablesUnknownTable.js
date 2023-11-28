import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { reportInteraction } from '@grafana/runtime';
import { CollapsableSection, HorizontalGroup, Icon, Spinner, Tooltip, useStyles2, VerticalGroup } from '@grafana/ui';
import { VariablesUnknownButton } from './VariablesUnknownButton';
import { getUnknownsNetwork } from './utils';
export const SLOW_VARIABLES_EXPANSION_THRESHOLD = 1000;
export function VariablesUnknownTable({ variables, dashboard }) {
    const [open, setOpen] = useState(false);
    const [changed, setChanged] = useState(0);
    const [usages, setUsages] = useState([]);
    const style = useStyles2(getStyles);
    useEffect(() => setChanged((prevState) => prevState + 1), [variables, dashboard]);
    const { loading } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (open && changed > 0) {
            // make sure we only fetch when opened and variables or dashboard have changed
            const start = Date.now();
            const unknownsNetwork = yield getUnknownsNetwork(variables, dashboard);
            const stop = Date.now();
            const elapsed = stop - start;
            if (elapsed >= SLOW_VARIABLES_EXPANSION_THRESHOLD) {
                reportInteraction('Slow unknown variables expansion', { elapsed });
            }
            setChanged(0);
            setUsages(unknownsNetwork);
            return unknownsNetwork;
        }
        return [];
    }), [variables, dashboard, open, changed]);
    const onToggle = (isOpen) => {
        if (isOpen) {
            reportInteraction('Unknown variables section expanded');
        }
        setOpen(isOpen);
    };
    return (React.createElement("div", { className: style.container },
        React.createElement(CollapsableSection, { label: React.createElement(CollapseLabel, null), isOpen: open, onToggle: onToggle },
            loading && (React.createElement(VerticalGroup, { justify: "center" },
                React.createElement(HorizontalGroup, { justify: "center" },
                    React.createElement("span", null, "Loading..."),
                    React.createElement(Spinner, { size: 16 })))),
            !loading && usages && (React.createElement(React.Fragment, null,
                usages.length === 0 && React.createElement(NoUnknowns, null),
                usages.length > 0 && React.createElement(UnknownTable, { usages: usages }))))));
}
function CollapseLabel() {
    const style = useStyles2(getStyles);
    return (React.createElement("h5", null,
        "Renamed or missing variables",
        React.createElement(Tooltip, { content: "Click to expand a list with all variable references that have been renamed or are missing from the dashboard." },
            React.createElement(Icon, { name: "info-circle", className: style.infoIcon }))));
}
function NoUnknowns() {
    return React.createElement("span", null, "No renamed or missing variables found.");
}
function UnknownTable({ usages }) {
    const style = useStyles2(getStyles);
    return (React.createElement("table", { className: "filter-table filter-table--hover" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Variable"),
                React.createElement("th", { colSpan: 5 }))),
        React.createElement("tbody", null, usages.map((usage) => {
            const { variable } = usage;
            const { id, name } = variable;
            return (React.createElement("tr", { key: id },
                React.createElement("td", { className: style.firstColumn },
                    React.createElement("span", null, name)),
                React.createElement("td", { className: style.defaultColumn }),
                React.createElement("td", { className: style.defaultColumn }),
                React.createElement("td", { className: style.defaultColumn }),
                React.createElement("td", { className: style.lastColumn },
                    React.createElement(VariablesUnknownButton, { id: variable.id, usages: usages }))));
        }))));
}
const getStyles = (theme) => ({
    container: css `
    margin-top: ${theme.spacing(4)};
    padding-top: ${theme.spacing(4)};
  `,
    infoIcon: css `
    margin-left: ${theme.spacing(1)};
  `,
    defaultColumn: css `
    width: 1%;
  `,
    firstColumn: css `
    width: 1%;
    vertical-align: top;
    color: ${theme.colors.text.maxContrast};
  `,
    lastColumn: css `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    text-align: right;
  `,
});
//# sourceMappingURL=VariablesUnknownTable.js.map