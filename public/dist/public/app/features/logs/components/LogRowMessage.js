import React, { useMemo } from 'react';
import Highlighter from 'react-highlight-words';
import { findHighlightChunksInText } from '@grafana/data';
import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowMenuCell } from './LogRowMenuCell';
export const MAX_CHARACTERS = 100000;
const LogMessage = ({ hasAnsi, entry, highlights, styles }) => {
    const needsHighlighter = highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
    const searchWords = highlights !== null && highlights !== void 0 ? highlights : [];
    if (hasAnsi) {
        const highlight = needsHighlighter ? { searchWords, highlightClassName: styles.logsRowMatchHighLight } : undefined;
        return React.createElement(LogMessageAnsi, { value: entry, highlight: highlight });
    }
    else if (needsHighlighter) {
        return (React.createElement(Highlighter, { textToHighlight: entry, searchWords: searchWords, findChunks: findHighlightChunksInText, highlightClassName: styles.logsRowMatchHighLight }));
    }
    return React.createElement(React.Fragment, null, entry);
};
const restructureLog = (line, prettifyLogMessage) => {
    if (prettifyLogMessage) {
        try {
            return JSON.stringify(JSON.parse(line), undefined, 2);
        }
        catch (error) {
            return line;
        }
    }
    return line;
};
export const LogRowMessage = React.memo((props) => {
    const { row, wrapLogMessage, prettifyLogMessage, showContextToggle, styles, onOpenContext, onPermalinkClick, onUnpinLine, onPinLine, pinned, mouseIsOver, onBlur, } = props;
    const { hasAnsi, raw } = row;
    const restructuredEntry = useMemo(() => restructureLog(raw, prettifyLogMessage), [raw, prettifyLogMessage]);
    const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);
    return (React.createElement(React.Fragment, null,
        React.createElement("td", { className: styles.logsRowMessage },
            React.createElement("div", { className: wrapLogMessage ? styles.positionRelative : styles.horizontalScroll },
                React.createElement("button", { className: `${styles.logLine} ${styles.positionRelative}` },
                    React.createElement(LogMessage, { hasAnsi: hasAnsi, entry: restructuredEntry, highlights: row.searchWords, styles: styles })))),
        React.createElement("td", { className: `log-row-menu-cell ${styles.logRowMenuCell}` }, shouldShowMenu && (React.createElement(LogRowMenuCell, { logText: restructuredEntry, row: row, showContextToggle: showContextToggle, onOpenContext: onOpenContext, onPermalinkClick: onPermalinkClick, onPinLine: onPinLine, onUnpinLine: onUnpinLine, pinned: pinned, styles: styles, mouseIsOver: mouseIsOver, onBlur: onBlur })))));
});
LogRowMessage.displayName = 'LogRowMessage';
//# sourceMappingURL=LogRowMessage.js.map