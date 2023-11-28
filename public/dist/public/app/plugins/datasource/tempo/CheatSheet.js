import React from 'react';
import { config, reportInteraction } from '@grafana/runtime';
export default function CheatSheet() {
    reportInteraction('grafana_traces_cheatsheet_clicked', {
        datasourceType: 'tempo',
        grafana_version: config.buildInfo.version,
    });
    return (React.createElement("div", null,
        React.createElement("h2", { id: "tempo-cheat-sheet" }, "Tempo Cheat Sheet"),
        React.createElement("p", null, "Tempo is a trace id lookup store. Enter a trace id in the above field and hit \u201CRun Query\u201D to retrieve your trace. Tempo is generally paired with other datasources such as Loki or Prometheus to find traces."),
        React.createElement("p", null,
            "Here are some",
            ' ',
            React.createElement("a", { href: "https://grafana.com/docs/tempo/latest/guides/instrumentation/", target: "blank" }, "instrumentation examples"),
            ' ',
            "to get you started with trace discovery through logs and metrics (exemplars).")));
}
//# sourceMappingURL=CheatSheet.js.map