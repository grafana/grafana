import React from 'react';
var CHEAT_SHEET_ITEMS = [
    {
        title: 'See your logs',
        label: 'Start by selecting a log stream from the Log labels selector.',
    },
    {
        title: 'Logs from a "job"',
        expression: '{job="default/prometheus"}',
        label: 'Returns all log lines emitted by instances of this job.',
    },
    {
        title: 'Combine stream selectors',
        expression: '{app="cassandra",namespace="prod"}',
        label: 'Returns all log lines from streams that have both labels.',
    },
    {
        title: 'Search for text',
        expression: '{app="cassandra"} (duration|latency)\\s*(=|is|of)\\s*[\\d\\.]+',
        label: 'Add a regular expression after the selector to filter for.',
    },
];
export default (function (props) { return (React.createElement("div", null,
    React.createElement("h2", null, "Loki Cheat Sheet"),
    CHEAT_SHEET_ITEMS.map(function (item) { return (React.createElement("div", { className: "cheat-sheet-item", key: item.title },
        React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
        item.expression && (React.createElement("div", { className: "cheat-sheet-item__expression", onClick: function (e) { return props.onClickExample({ refId: '1', expr: item.expression }); } },
            React.createElement("code", null, item.expression))),
        React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))); }))); });
//# sourceMappingURL=LokiCheatSheet.js.map