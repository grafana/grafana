import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { LogRowMenuCell } from './LogRowMenuCell';
import { getAllFields } from './logParser';
export const LogRowMessageDisplayedFields = React.memo((props) => {
    const { row, detectedFields, getFieldLinks, wrapLogMessage, styles, mouseIsOver, pinned } = props, rest = __rest(props, ["row", "detectedFields", "getFieldLinks", "wrapLogMessage", "styles", "mouseIsOver", "pinned"]);
    const fields = getAllFields(row, getFieldLinks);
    const wrapClassName = wrapLogMessage ? '' : displayedFieldsStyles.noWrap;
    // only single key/value rows are filterable, so we only need the first field key for filtering
    const line = useMemo(() => detectedFields
        .map((parsedKey) => {
        const field = fields.find((field) => {
            const { keys } = field;
            return keys[0] === parsedKey;
        });
        if (field !== undefined && field !== null) {
            return `${parsedKey}=${field.values}`;
        }
        if (row.labels[parsedKey] !== undefined && row.labels[parsedKey] !== null) {
            return `${parsedKey}=${row.labels[parsedKey]}`;
        }
        return null;
    })
        .filter((s) => s !== null)
        .join(' '), [detectedFields, fields, row.labels]);
    const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);
    return (React.createElement(React.Fragment, null,
        React.createElement("td", { className: styles.logsRowMessage },
            React.createElement("div", { className: wrapClassName }, line)),
        React.createElement("td", { className: `log-row-menu-cell ${styles.logRowMenuCell}` }, shouldShowMenu && (React.createElement(LogRowMenuCell, Object.assign({ logText: line, row: row, styles: styles, pinned: pinned, mouseIsOver: mouseIsOver }, rest))))));
});
const displayedFieldsStyles = {
    noWrap: css `
    white-space: nowrap;
  `,
};
LogRowMessageDisplayedFields.displayName = 'LogRowMessageDisplayedFields';
//# sourceMappingURL=LogRowMessageDisplayedFields.js.map