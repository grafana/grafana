import { isUndefined, omitBy, sum } from 'lodash';
import pluralize from 'pluralize';
import React, { Fragment } from 'react';
import { Stack } from '@grafana/experimental';
import { Badge } from '@grafana/ui';
import { AlertInstanceTotalState, } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
// All available states for a rule need to be initialized to prevent NaN values when adding a number and undefined
const emptyStats = {
    recording: 0,
    alerting: 0,
    [PromAlertingRuleState.Pending]: 0,
    [PromAlertingRuleState.Inactive]: 0,
    paused: 0,
    error: 0,
    nodata: 0,
};
export const RuleStats = ({ namespaces }) => {
    const stats = Object.assign({}, emptyStats);
    // sum all totals for all namespaces
    namespaces.forEach(({ groups }) => {
        groups.forEach((group) => {
            const groupTotals = omitBy(group.totals, isUndefined);
            for (let key in groupTotals) {
                // @ts-ignore
                stats[key] += groupTotals[key];
            }
        });
    });
    const statsComponents = getComponentsFromStats(stats);
    const hasStats = Boolean(statsComponents.length);
    const total = sum(Object.values(stats));
    statsComponents.unshift(React.createElement(Fragment, { key: "total" },
        total,
        " ",
        pluralize('rule', total)));
    return (React.createElement(Stack, { direction: "row" }, hasStats && (React.createElement("div", null,
        React.createElement(Stack, { gap: 0.5 }, statsComponents)))));
};
export const RuleGroupStats = ({ group }) => {
    const stats = group.totals;
    const evaluationInterval = group === null || group === void 0 ? void 0 : group.interval;
    const statsComponents = getComponentsFromStats(stats);
    const hasStats = Boolean(statsComponents.length);
    return (React.createElement(Stack, { direction: "row" },
        hasStats && (React.createElement("div", null,
            React.createElement(Stack, { gap: 0.5 }, statsComponents))),
        evaluationInterval && (React.createElement(React.Fragment, null,
            React.createElement("div", null, "|"),
            React.createElement(Badge, { text: evaluationInterval, icon: "clock-nine", color: 'blue' })))));
};
export function getComponentsFromStats(stats) {
    const statsComponents = [];
    if (stats[AlertInstanceTotalState.Alerting]) {
        statsComponents.push(React.createElement(Badge, { color: "red", key: "firing", text: `${stats[AlertInstanceTotalState.Alerting]} firing` }));
    }
    if (stats.error) {
        statsComponents.push(React.createElement(Badge, { color: "red", key: "errors", text: `${stats.error} errors` }));
    }
    if (stats.nodata) {
        statsComponents.push(React.createElement(Badge, { color: "blue", key: "nodata", text: `${stats.nodata} no data` }));
    }
    if (stats[AlertInstanceTotalState.Pending]) {
        statsComponents.push(React.createElement(Badge, { color: 'orange', key: "pending", text: `${stats[AlertInstanceTotalState.Pending]} pending` }));
    }
    if (stats[AlertInstanceTotalState.Normal] && stats.paused) {
        statsComponents.push(React.createElement(Badge, { color: "green", key: "paused", text: `${stats[AlertInstanceTotalState.Normal]} normal (${stats.paused} paused)` }));
    }
    if (stats[AlertInstanceTotalState.Normal] && !stats.paused) {
        statsComponents.push(React.createElement(Badge, { color: "green", key: "inactive", text: `${stats[AlertInstanceTotalState.Normal]} normal` }));
    }
    if (stats.recording) {
        statsComponents.push(React.createElement(Badge, { color: "purple", key: "recording", text: `${stats.recording} recording` }));
    }
    return statsComponents;
}
//# sourceMappingURL=RuleStats.js.map