import * as tslib_1 from "tslib";
import ansicolor from 'vendor/ansicolor/ansicolor';
import _ from 'lodash';
import moment from 'moment';
import { LogLevel, LogsMetaKind, } from 'app/core/logs_model';
import { hasAnsiCodes } from 'app/core/utils/text';
import { DEFAULT_MAX_LINES } from './datasource';
/**
 * Returns the log level of a log line.
 * Parse the line for level words. If no level is found, it returns `LogLevel.unknown`.
 *
 * Example: `getLogLevel('WARN 1999-12-31 this is great') // LogLevel.warn`
 */
export function getLogLevel(line) {
    if (!line) {
        return LogLevel.unknown;
    }
    var level;
    Object.keys(LogLevel).forEach(function (key) {
        if (!level) {
            var regexp = new RegExp("\\b" + key + "\\b", 'i');
            if (regexp.test(line)) {
                level = LogLevel[key];
            }
        }
    });
    if (!level) {
        level = LogLevel.unknown;
    }
    return level;
}
/**
 * Regexp to extract Prometheus-style labels
 */
var labelRegexp = /\b(\w+)(!?=~?)"([^"\n]*?)"/g;
/**
 * Returns a map of label keys to value from an input selector string.
 *
 * Example: `parseLabels('{job="foo", instance="bar"}) // {job: "foo", instance: "bar"}`
 */
export function parseLabels(labels) {
    var labelsByKey = {};
    labels.replace(labelRegexp, function (_, key, operator, value) {
        labelsByKey[key] = value;
        return '';
    });
    return labelsByKey;
}
/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelsSets) {
    return labelsSets.reduce(function (acc, labels) {
        if (!labels) {
            throw new Error('Need parsed labels to find common labels.');
        }
        if (!acc) {
            // Initial set
            acc = tslib_1.__assign({}, labels);
        }
        else {
            // Remove incoming labels that are missing or not matching in value
            Object.keys(labels).forEach(function (key) {
                if (acc[key] === undefined || acc[key] !== labels[key]) {
                    delete acc[key];
                }
            });
            // Remove common labels that are missing from incoming label set
            Object.keys(acc).forEach(function (key) {
                if (labels[key] === undefined) {
                    delete acc[key];
                }
            });
        }
        return acc;
    }, undefined);
}
/**
 * Returns a map of labels that are in `labels`, but not in `commonLabels`.
 */
export function findUniqueLabels(labels, commonLabels) {
    var uncommonLabels = tslib_1.__assign({}, labels);
    Object.keys(commonLabels).forEach(function (key) {
        delete uncommonLabels[key];
    });
    return uncommonLabels;
}
/**
 * Serializes the given labels to a string.
 */
export function formatLabels(labels, defaultValue) {
    if (defaultValue === void 0) { defaultValue = ''; }
    if (!labels || Object.keys(labels).length === 0) {
        return defaultValue;
    }
    var labelKeys = Object.keys(labels).sort();
    var cleanSelector = labelKeys.map(function (key) { return key + "=\"" + labels[key] + "\""; }).join(', ');
    return ['{', cleanSelector, '}'].join('');
}
export function processEntry(entry, labels, parsedLabels, uniqueLabels, search) {
    var line = entry.line;
    var ts = entry.ts || entry.timestamp;
    // Assumes unique-ness, needs nanosec precision for timestamp
    var key = "EK" + ts + labels;
    var time = moment(ts);
    var timeEpochMs = time.valueOf();
    var timeFromNow = time.fromNow();
    var timeLocal = time.format('YYYY-MM-DD HH:mm:ss');
    var logLevel = getLogLevel(line);
    var hasAnsi = hasAnsiCodes(line);
    return {
        key: key,
        logLevel: logLevel,
        timeFromNow: timeFromNow,
        timeEpochMs: timeEpochMs,
        timeLocal: timeLocal,
        uniqueLabels: uniqueLabels,
        hasAnsi: hasAnsi,
        entry: hasAnsi ? ansicolor.strip(line) : line,
        raw: line,
        labels: parsedLabels,
        searchWords: search ? [search] : [],
        timestamp: ts,
    };
}
export function mergeStreamsToLogs(streams, limit) {
    if (limit === void 0) { limit = DEFAULT_MAX_LINES; }
    // Unique model identifier
    var id = streams.map(function (stream) { return stream.labels; }).join();
    // Find unique labels for each stream
    streams = streams.map(function (stream) { return (tslib_1.__assign({}, stream, { parsedLabels: parseLabels(stream.labels) })); });
    var commonLabels = findCommonLabels(streams.map(function (model) { return model.parsedLabels; }));
    streams = streams.map(function (stream) { return (tslib_1.__assign({}, stream, { uniqueLabels: findUniqueLabels(stream.parsedLabels, commonLabels) })); });
    // Merge stream entries into single list of log rows
    var sortedRows = _.chain(streams)
        .reduce(function (acc, stream) { return tslib_1.__spread(acc, stream.entries.map(function (entry) {
        return processEntry(entry, stream.labels, stream.parsedLabels, stream.uniqueLabels, stream.search);
    })); }, [])
        .sortBy('timestamp')
        .reverse()
        .value();
    // Meta data to display in status
    var meta = [];
    if (_.size(commonLabels) > 0) {
        meta.push({
            label: 'Common labels',
            value: commonLabels,
            kind: LogsMetaKind.LabelsMap,
        });
    }
    if (limit) {
        meta.push({
            label: 'Limit',
            value: limit + " (" + sortedRows.length + " returned)",
            kind: LogsMetaKind.String,
        });
    }
    return {
        id: id,
        meta: meta,
        rows: sortedRows,
    };
}
//# sourceMappingURL=result_transformer.js.map