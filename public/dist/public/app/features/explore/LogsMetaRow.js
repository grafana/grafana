import { __read, __spreadArray } from "tslib";
import React from 'react';
import { LogsDedupStrategy, LogsMetaKind } from '@grafana/data';
import { Button, Tooltip, Icon, LogLabels } from '@grafana/ui';
import { MAX_CHARACTERS } from '@grafana/ui/src/components/Logs/LogRowMessage';
import { MetaInfoText } from './MetaInfoText';
export var LogsMetaRow = React.memo(function (_a) {
    var meta = _a.meta, dedupStrategy = _a.dedupStrategy, dedupCount = _a.dedupCount, showDetectedFields = _a.showDetectedFields, clearDetectedFields = _a.clearDetectedFields, hasUnescapedContent = _a.hasUnescapedContent, forceEscape = _a.forceEscape, onEscapeNewlines = _a.onEscapeNewlines, logRows = _a.logRows;
    var logsMetaItem = __spreadArray([], __read(meta), false);
    // Add deduplication info
    if (dedupStrategy !== LogsDedupStrategy.none) {
        logsMetaItem.push({
            label: 'Dedup count',
            value: dedupCount,
            kind: LogsMetaKind.Number,
        });
    }
    // Add info about limit for highlighting
    if (logRows.some(function (r) { return r.entry.length > MAX_CHARACTERS; })) {
        logsMetaItem.push({
            label: 'Info',
            value: 'Logs with more than 100,000 characters could not be parsed and highlighted',
            kind: LogsMetaKind.String,
        });
    }
    // Add detected fields info
    if ((showDetectedFields === null || showDetectedFields === void 0 ? void 0 : showDetectedFields.length) > 0) {
        logsMetaItem.push({
            label: 'Showing only detected fields',
            value: renderMetaItem(showDetectedFields, LogsMetaKind.LabelsMap),
        }, {
            label: '',
            value: (React.createElement(Button, { variant: "secondary", size: "sm", onClick: clearDetectedFields }, "Show all detected fields")),
        });
    }
    // Add unescaped content info
    if (hasUnescapedContent) {
        logsMetaItem.push({
            label: 'Your logs might have incorrectly escaped content',
            value: (React.createElement(Tooltip, { content: "We suggest to try to fix the escaping of your log lines first. This is an experimental feature, your logs might not be correctly escaped.", placement: "right" },
                React.createElement(Button, { variant: "secondary", size: "sm", onClick: onEscapeNewlines },
                    React.createElement("span", null,
                        forceEscape ? 'Remove escaping' : 'Escape newlines',
                        "\u00A0"),
                    React.createElement(Icon, { name: "exclamation-triangle", className: "muted", size: "sm" })))),
        });
    }
    return (React.createElement(React.Fragment, null, logsMetaItem && (React.createElement(MetaInfoText, { metaItems: logsMetaItem.map(function (item) {
            return {
                label: item.label,
                value: 'kind' in item ? renderMetaItem(item.value, item.kind) : item.value,
            };
        }) }))));
});
LogsMetaRow.displayName = 'LogsMetaRow';
function renderMetaItem(value, kind) {
    if (kind === LogsMetaKind.LabelsMap) {
        return (React.createElement("span", { className: "logs-meta-item__labels" },
            React.createElement(LogLabels, { labels: value })));
    }
    else if (kind === LogsMetaKind.Error) {
        return React.createElement("span", { className: "logs-meta-item__error" }, value);
    }
    return value;
}
//# sourceMappingURL=LogsMetaRow.js.map