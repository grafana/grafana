import { css } from '@emotion/css';
import React from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui';
export function TraceIdTimeParams({ options, onOptionsChange }) {
    var _a;
    return (React.createElement("div", { className: styles.container },
        React.createElement("h3", { className: "page-heading" }, "Query Trace by ID with Time Params"),
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "pass time parameters when querying trace by ID", label: "Enable Time Parameters", labelWidth: 26 },
                React.createElement(InlineSwitch, { id: "enableTraceIdTimeParams", value: (_a = options.jsonData.traceIdTimeParams) === null || _a === void 0 ? void 0 : _a.enabled, onChange: (event) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceIdTimeParams', Object.assign(Object.assign({}, options.jsonData.traceIdTimeParams), { enabled: event.currentTarget.checked })) })))));
}
const styles = {
    container: css `
    label: container;
    width: 100%;
  `,
    row: css `
    label: row;
    align-items: baseline;
  `,
};
//# sourceMappingURL=TraceIdTimeParams.js.map