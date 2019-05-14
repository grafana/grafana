import React from 'react';
var CHEAT_SHEET_ITEMS = [
    {
        title: 'Request Rate',
        expression: 'rate(http_request_total[5m])',
        label: 'Given an HTTP request counter, this query calculates the per-second average request rate over the last 5 minutes.',
    },
    {
        title: '95th Percentile of Request Latencies',
        expression: 'histogram_quantile(0.95, sum(rate(prometheus_http_request_duration_seconds_bucket[5m])) by (le))',
        label: 'Calculates the 95th percentile of HTTP request rate over 5 minute windows.',
    },
    {
        title: 'Alerts Firing',
        expression: 'sort_desc(sum(sum_over_time(ALERTS{alertstate="firing"}[24h])) by (alertname))',
        label: 'Sums up the alerts that have been firing over the last 24 hours.',
    },
];
export default (function (props) { return (React.createElement("div", null,
    React.createElement("h2", null, "PromQL Cheat Sheet"),
    CHEAT_SHEET_ITEMS.map(function (item) { return (React.createElement("div", { className: "cheat-sheet-item", key: item.expression },
        React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
        React.createElement("div", { className: "cheat-sheet-item__expression", onClick: function (e) { return props.onClickExample({ refId: '1', expr: item.expression }); } },
            React.createElement("code", null, item.expression)),
        React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))); }))); });
//# sourceMappingURL=PromCheatSheet.js.map