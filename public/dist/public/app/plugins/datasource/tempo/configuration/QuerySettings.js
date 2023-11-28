import { css } from '@emotion/css';
import React from 'react';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';
import { IntervalInput } from 'app/core/components/IntervalInput/IntervalInput';
import { invalidTimeShiftError } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
export function QuerySettings({ options, onOptionsChange }) {
    var _a, _b, _c, _d, _e;
    const styles = useStyles2(getStyles);
    const getLabel = (type) => {
        return `Time shift for ${type} of search`;
    };
    const getTooltip = (type) => {
        return `Shifts the ${type} of the time range when searching by TraceID. Searching can return traces that do not fully fall into the search time range, so we recommend using higher time shifts for longer traces. Default: 30m (Time units can be used here, for example: 5s, 1m, 3h`;
    };
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineField, { label: "Use time range in query", tooltip: "The time range can be used when there are performance issues or timeouts since it will narrow down the search to the defined range. Default: disabled", labelWidth: 26 },
            React.createElement(InlineSwitch, { id: "enable-time-shift", value: ((_a = options.jsonData.traceQuery) === null || _a === void 0 ? void 0 : _a.timeShiftEnabled) || false, onChange: (event) => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceQuery', Object.assign(Object.assign({}, options.jsonData.traceQuery), { timeShiftEnabled: event.currentTarget.checked }));
                } })),
        React.createElement(IntervalInput, { label: getLabel('start'), tooltip: getTooltip('start'), value: ((_b = options.jsonData.traceQuery) === null || _b === void 0 ? void 0 : _b.spanStartTimeShift) || '', disabled: !((_c = options.jsonData.traceQuery) === null || _c === void 0 ? void 0 : _c.timeShiftEnabled), onChange: (val) => {
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceQuery', Object.assign(Object.assign({}, options.jsonData.traceQuery), { spanStartTimeShift: val }));
            }, isInvalidError: invalidTimeShiftError }),
        React.createElement(IntervalInput, { label: getLabel('end'), tooltip: getTooltip('end'), value: ((_d = options.jsonData.traceQuery) === null || _d === void 0 ? void 0 : _d.spanEndTimeShift) || '', disabled: !((_e = options.jsonData.traceQuery) === null || _e === void 0 ? void 0 : _e.timeShiftEnabled), onChange: (val) => {
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'traceQuery', Object.assign(Object.assign({}, options.jsonData.traceQuery), { spanEndTimeShift: val }));
            }, isInvalidError: invalidTimeShiftError })));
}
export const getStyles = (theme) => ({
    infoText: css `
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
    container: css `
    width: 100%;
  `,
    row: css `
    align-items: baseline;
  `,
});
//# sourceMappingURL=QuerySettings.js.map