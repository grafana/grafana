import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';
import { css, cx } from '@emotion/css';
import { findHighlightChunksInText } from '@grafana/data';
import memoizeOne from 'memoize-one';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { withTheme2 } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
//Components
import { LogRowContext } from './LogRowContext';
import { LogMessageAnsi } from './LogMessageAnsi';
export var MAX_CHARACTERS = 100000;
var getStyles = function (theme) {
    var outlineColor = tinycolor(theme.components.dashboard.background).setAlpha(0.7).toRgbString();
    return {
        positionRelative: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: positionRelative;\n      position: relative;\n    "], ["\n      label: positionRelative;\n      position: relative;\n    "]))),
        rowWithContext: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: rowWithContext;\n      z-index: 1;\n      outline: 9999px solid ", ";\n    "], ["\n      label: rowWithContext;\n      z-index: 1;\n      outline: 9999px solid ", ";\n    "])), outlineColor),
        horizontalScroll: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: verticalScroll;\n      white-space: pre;\n    "], ["\n      label: verticalScroll;\n      white-space: pre;\n    "]))),
        contextNewline: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: block;\n      margin-left: 0px;\n    "], ["\n      display: block;\n      margin-left: 0px;\n    "]))),
    };
};
function renderLogMessage(hasAnsi, entry, highlights, highlightClassName) {
    var needsHighlighter = highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
    if (needsHighlighter) {
        return (React.createElement(Highlighter, { textToHighlight: entry, searchWords: highlights !== null && highlights !== void 0 ? highlights : [], findChunks: findHighlightChunksInText, highlightClassName: highlightClassName }));
    }
    else if (hasAnsi) {
        return React.createElement(LogMessageAnsi, { value: entry });
    }
    else {
        return entry;
    }
}
var restructureLog = memoizeOne(function (line, prettifyLogMessage) {
    if (prettifyLogMessage) {
        try {
            return JSON.stringify(JSON.parse(line), undefined, 2);
        }
        catch (error) {
            return line;
        }
    }
    return line;
});
var UnThemedLogRowMessage = /** @class */ (function (_super) {
    __extends(UnThemedLogRowMessage, _super);
    function UnThemedLogRowMessage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onContextToggle = function (e) {
            e.stopPropagation();
            _this.props.onToggleContext();
        };
        return _this;
    }
    UnThemedLogRowMessage.prototype.render = function () {
        var _a, _b, _c, _d;
        var _e = this.props, row = _e.row, theme = _e.theme, errors = _e.errors, hasMoreContextRows = _e.hasMoreContextRows, updateLimit = _e.updateLimit, context = _e.context, contextIsOpen = _e.contextIsOpen, showContextToggle = _e.showContextToggle, wrapLogMessage = _e.wrapLogMessage, prettifyLogMessage = _e.prettifyLogMessage, onToggleContext = _e.onToggleContext;
        var style = getLogRowStyles(theme, row.logLevel);
        var hasAnsi = row.hasAnsi, raw = row.raw;
        var restructuredEntry = restructureLog(raw, prettifyLogMessage);
        var highlightClassName = cx([style.logsRowMatchHighLight]);
        var styles = getStyles(theme);
        return (React.createElement("td", { className: style.logsRowMessage },
            React.createElement("div", { className: cx((_a = {}, _a[styles.positionRelative] = wrapLogMessage, _a), (_b = {}, _b[styles.horizontalScroll] = !wrapLogMessage, _b)) },
                contextIsOpen && context && (React.createElement(LogRowContext, { row: row, context: context, errors: errors, wrapLogMessage: wrapLogMessage, hasMoreContextRows: hasMoreContextRows, onOutsideClick: onToggleContext, onLoadMoreContext: function () {
                        if (updateLimit) {
                            updateLimit();
                        }
                    } })),
                React.createElement("span", { className: cx(styles.positionRelative, (_c = {}, _c[styles.rowWithContext] = contextIsOpen, _c)) }, renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, highlightClassName)),
                (showContextToggle === null || showContextToggle === void 0 ? void 0 : showContextToggle(row)) && (React.createElement("span", { onClick: this.onContextToggle, className: cx('log-row-context', style.context, (_d = {}, _d[styles.contextNewline] = !wrapLogMessage, _d)) },
                    contextIsOpen ? 'Hide' : 'Show',
                    " context")))));
    };
    return UnThemedLogRowMessage;
}(PureComponent));
export var LogRowMessage = withTheme2(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=LogRowMessage.js.map