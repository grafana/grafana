import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import _ from 'lodash';
import Highlighter from 'react-highlight-words';
import classnames from 'classnames';
import { calculateFieldStats, getParser } from 'app/core/logs_model';
import { LogLabels } from './LogLabels';
import { findHighlightChunksInText } from 'app/core/utils/text';
import { LogLabelStats } from './LogLabelStats';
import { LogMessageAnsi } from './LogMessageAnsi';
/**
 * Renders a highlighted field.
 * When hovering, a stats icon is shown.
 */
var FieldHighlight = function (onClick) { return function (props) {
    return (React.createElement("span", { className: props.className, style: props.style },
        props.children,
        React.createElement("span", { className: "logs-row__field-highlight--icon fa fa-signal", onClick: function () { return onClick(props.children); } })));
}; };
/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
var LogRow = /** @class */ (function (_super) {
    tslib_1.__extends(LogRow, _super);
    function LogRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            fieldCount: 0,
            fieldLabel: null,
            fieldStats: null,
            fieldValue: null,
            parsed: false,
            parser: undefined,
            parsedFieldHighlights: [],
            showFieldStats: false,
        };
        _this.onClickClose = function () {
            _this.setState({ showFieldStats: false });
        };
        _this.onClickHighlight = function (fieldText) {
            var getRows = _this.props.getRows;
            var parser = _this.state.parser;
            var allRows = getRows();
            // Build value-agnostic row matcher based on the field label
            var fieldLabel = parser.getLabelFromField(fieldText);
            var fieldValue = parser.getValueFromField(fieldText);
            var matcher = parser.buildMatcher(fieldLabel);
            var fieldStats = calculateFieldStats(allRows, matcher);
            var fieldCount = fieldStats.reduce(function (sum, stat) { return sum + stat.count; }, 0);
            _this.setState({ fieldCount: fieldCount, fieldLabel: fieldLabel, fieldStats: fieldStats, fieldValue: fieldValue, showFieldStats: true });
        };
        _this.onMouseOverMessage = function () {
            // Don't parse right away, user might move along
            _this.mouseMessageTimer = setTimeout(_this.parseMessage, 500);
        };
        _this.onMouseOutMessage = function () {
            clearTimeout(_this.mouseMessageTimer);
            _this.setState({ parsed: false });
        };
        _this.parseMessage = function () {
            if (!_this.state.parsed) {
                var row = _this.props.row;
                var parser = getParser(row.entry);
                if (parser) {
                    // Use parser to highlight detected fields
                    var parsedFieldHighlights = parser.getFields(_this.props.row.entry);
                    _this.setState({ parsedFieldHighlights: parsedFieldHighlights, parsed: true, parser: parser });
                }
            }
        };
        return _this;
    }
    LogRow.prototype.componentWillUnmount = function () {
        clearTimeout(this.mouseMessageTimer);
    };
    LogRow.prototype.render = function () {
        var _a = this.props, getRows = _a.getRows, highlighterExpressions = _a.highlighterExpressions, onClickLabel = _a.onClickLabel, row = _a.row, showDuplicates = _a.showDuplicates, showLabels = _a.showLabels, showLocalTime = _a.showLocalTime, showUtc = _a.showUtc;
        var _b = this.state, fieldCount = _b.fieldCount, fieldLabel = _b.fieldLabel, fieldStats = _b.fieldStats, fieldValue = _b.fieldValue, parsed = _b.parsed, parsedFieldHighlights = _b.parsedFieldHighlights, showFieldStats = _b.showFieldStats;
        var entry = row.entry, hasAnsi = row.hasAnsi, raw = row.raw;
        var previewHighlights = highlighterExpressions && !_.isEqual(highlighterExpressions, row.searchWords);
        var highlights = previewHighlights ? highlighterExpressions : row.searchWords;
        var needsHighlighter = highlights && highlights.length > 0 && highlights[0].length > 0;
        var highlightClassName = classnames('logs-row__match-highlight', {
            'logs-row__match-highlight--preview': previewHighlights,
        });
        return (React.createElement("div", { className: "logs-row" },
            showDuplicates && (React.createElement("div", { className: "logs-row__duplicates" }, row.duplicates > 0 ? row.duplicates + 1 + "x" : null)),
            React.createElement("div", { className: row.logLevel ? "logs-row__level logs-row__level--" + row.logLevel : '' }),
            showUtc && (React.createElement("div", { className: "logs-row__time", title: "Local: " + row.timeLocal + " (" + row.timeFromNow + ")" }, row.timestamp)),
            showLocalTime && (React.createElement("div", { className: "logs-row__localtime", title: row.timestamp + " (" + row.timeFromNow + ")" }, row.timeLocal)),
            showLabels && (React.createElement("div", { className: "logs-row__labels" },
                React.createElement(LogLabels, { getRows: getRows, labels: row.uniqueLabels, onClickLabel: onClickLabel }))),
            React.createElement("div", { className: "logs-row__message", onMouseEnter: this.onMouseOverMessage, onMouseLeave: this.onMouseOutMessage },
                parsed && (React.createElement(Highlighter, { autoEscape: true, highlightTag: FieldHighlight(this.onClickHighlight), textToHighlight: entry, searchWords: parsedFieldHighlights, highlightClassName: "logs-row__field-highlight" })),
                !parsed && needsHighlighter && (React.createElement(Highlighter, { textToHighlight: entry, searchWords: highlights, findChunks: findHighlightChunksInText, highlightClassName: highlightClassName })),
                hasAnsi && !parsed && !needsHighlighter && React.createElement(LogMessageAnsi, { value: raw }),
                !hasAnsi && !parsed && !needsHighlighter && entry,
                showFieldStats && (React.createElement("div", { className: "logs-row__stats" },
                    React.createElement(LogLabelStats, { stats: fieldStats, label: fieldLabel, value: fieldValue, onClickClose: this.onClickClose, rowCount: fieldCount }))))));
    };
    return LogRow;
}(PureComponent));
export { LogRow };
//# sourceMappingURL=LogRow.js.map