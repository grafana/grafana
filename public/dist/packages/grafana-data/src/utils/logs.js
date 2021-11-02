import { __assign, __read, __spreadArray, __values } from "tslib";
import { countBy, chain, escapeRegExp } from 'lodash';
import { LogLevel, LogsSortOrder } from '../types/logs';
import { FieldType } from '../types/index';
import { ArrayVector } from '../vector/ArrayVector';
// This matches:
// first a label from start of the string or first white space, then any word chars until "="
// second either an empty quotes, or anything that starts with quote and ends with unescaped quote,
// or any non whitespace chars that do not start with quote
var LOGFMT_REGEXP = /(?:^|\s)([\w\(\)\[\]\{\}]+)=(""|(?:".*?[^\\]"|[^"\s]\S*))/;
/**
 * Returns the log level of a log line.
 * Parse the line for level words. If no level is found, it returns `LogLevel.unknown`.
 *
 * Example: `getLogLevel('WARN 1999-12-31 this is great') // LogLevel.warn`
 */
export function getLogLevel(line) {
    var e_1, _a;
    if (!line) {
        return LogLevel.unknown;
    }
    var level = LogLevel.unknown;
    var currentIndex = undefined;
    try {
        for (var _b = __values(Object.keys(LogLevel)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var key = _c.value;
            var regexp = new RegExp("\\b" + key + "\\b", 'i');
            var result = regexp.exec(line);
            if (result) {
                if (currentIndex === undefined || result.index < currentIndex) {
                    level = LogLevel[key];
                    currentIndex = result.index;
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return level;
}
export function getLogLevelFromKey(key) {
    var level = LogLevel[key.toString().toLowerCase()];
    if (level) {
        return level;
    }
    return LogLevel.unknown;
}
export function addLogLevelToSeries(series, lineIndex) {
    var levels = new ArrayVector();
    var lines = series.fields[lineIndex];
    for (var i = 0; i < lines.values.length; i++) {
        var line = lines.values.get(lineIndex);
        levels.buffer.push(getLogLevel(line));
    }
    return __assign(__assign({}, series), { fields: __spreadArray(__spreadArray([], __read(series.fields), false), [
            {
                name: 'LogLevel',
                type: FieldType.string,
                values: levels,
                config: {},
            },
        ], false) });
}
export var LogsParsers = {
    JSON: {
        buildMatcher: function (label) { return new RegExp("(?:{|,)\\s*\"" + label + "\"\\s*:\\s*\"?([\\d\\.]+|[^\"]*)\"?"); },
        getFields: function (line) {
            try {
                var parsed_1 = JSON.parse(line);
                return Object.keys(parsed_1).map(function (key) {
                    return "\"" + key + "\":" + JSON.stringify(parsed_1[key]);
                });
            }
            catch (_a) { }
            return [];
        },
        getLabelFromField: function (field) { return (field.match(/^"([^"]+)"\s*:/) || [])[1]; },
        getValueFromField: function (field) { return (field.match(/:\s*(.*)$/) || [])[1]; },
        test: function (line) {
            var parsed;
            try {
                parsed = JSON.parse(line);
            }
            catch (error) { }
            // The JSON parser should only be used for log lines that are valid serialized JSON objects.
            // If it would be used for a string, detected fields would include each letter as a separate field.
            return typeof parsed === 'object';
        },
    },
    logfmt: {
        buildMatcher: function (label) { return new RegExp("(?:^|\\s)" + escapeRegExp(label) + "=(\"[^\"]*\"|\\S+)"); },
        getFields: function (line) {
            var fields = [];
            line.replace(new RegExp(LOGFMT_REGEXP, 'g'), function (substring) {
                fields.push(substring.trim());
                return '';
            });
            return fields;
        },
        getLabelFromField: function (field) { return (field.match(LOGFMT_REGEXP) || [])[1]; },
        getValueFromField: function (field) { return (field.match(LOGFMT_REGEXP) || [])[2]; },
        test: function (line) { return LOGFMT_REGEXP.test(line); },
    },
};
export function calculateFieldStats(rows, extractor) {
    // Consider only rows that satisfy the matcher
    var rowsWithField = rows.filter(function (row) { return extractor.test(row.entry); });
    var rowCount = rowsWithField.length;
    // Get field value counts for eligible rows
    var countsByValue = countBy(rowsWithField, function (r) {
        var row = r;
        var match = row.entry.match(extractor);
        return match ? match[1] : null;
    });
    return getSortedCounts(countsByValue, rowCount);
}
export function calculateLogsLabelStats(rows, label) {
    // Consider only rows that have the given label
    var rowsWithLabel = rows.filter(function (row) { return row.labels[label] !== undefined; });
    var rowCount = rowsWithLabel.length;
    // Get label value counts for eligible rows
    var countsByValue = countBy(rowsWithLabel, function (row) { return row.labels[label]; });
    return getSortedCounts(countsByValue, rowCount);
}
export function calculateStats(values) {
    var nonEmptyValues = values.filter(function (value) { return value !== undefined && value !== null; });
    var countsByValue = countBy(nonEmptyValues);
    return getSortedCounts(countsByValue, nonEmptyValues.length);
}
var getSortedCounts = function (countsByValue, rowCount) {
    return chain(countsByValue)
        .map(function (count, value) { return ({ count: count, value: value, proportion: count / rowCount }); })
        .sortBy('count')
        .reverse()
        .value();
};
export function getParser(line) {
    var parser;
    try {
        if (LogsParsers.JSON.test(line)) {
            parser = LogsParsers.JSON;
        }
    }
    catch (error) { }
    if (!parser && LogsParsers.logfmt.test(line)) {
        parser = LogsParsers.logfmt;
    }
    return parser;
}
export var sortInAscendingOrder = function (a, b) {
    // compare milliseconds
    if (a.timeEpochMs < b.timeEpochMs) {
        return -1;
    }
    if (a.timeEpochMs > b.timeEpochMs) {
        return 1;
    }
    // if milliseconds are equal, compare nanoseconds
    if (a.timeEpochNs < b.timeEpochNs) {
        return -1;
    }
    if (a.timeEpochNs > b.timeEpochNs) {
        return 1;
    }
    return 0;
};
export var sortInDescendingOrder = function (a, b) {
    // compare milliseconds
    if (a.timeEpochMs > b.timeEpochMs) {
        return -1;
    }
    if (a.timeEpochMs < b.timeEpochMs) {
        return 1;
    }
    // if milliseconds are equal, compare nanoseconds
    if (a.timeEpochNs > b.timeEpochNs) {
        return -1;
    }
    if (a.timeEpochNs < b.timeEpochNs) {
        return 1;
    }
    return 0;
};
export var sortLogsResult = function (logsResult, sortOrder) {
    var rows = logsResult ? sortLogRows(logsResult.rows, sortOrder) : [];
    return logsResult ? __assign(__assign({}, logsResult), { rows: rows }) : { hasUniqueLabels: false, rows: rows };
};
export var sortLogRows = function (logRows, sortOrder) {
    return sortOrder === LogsSortOrder.Ascending ? logRows.sort(sortInAscendingOrder) : logRows.sort(sortInDescendingOrder);
};
// Currently supports only error condition in Loki logs
export var checkLogsError = function (logRow) {
    if (logRow.labels.__error__) {
        return {
            hasError: true,
            errorMessage: logRow.labels.__error__,
        };
    }
    return {
        hasError: false,
    };
};
export var escapeUnescapedString = function (string) {
    return string.replace(/\\n|\\t|\\r/g, function (match) { return (match.slice(1) === 't' ? '\t' : '\n'); });
};
//# sourceMappingURL=logs.js.map