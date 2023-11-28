import React from 'react';
import { InlineFieldRow, InlineLabel, InlineSegmentGroup } from '@grafana/ui';
import { SettingsEditor } from './MetricAggregationsEditor/SettingsEditor';
export const QueryEditorSpecialMetricRow = ({ name, metric }) => {
    // this widget is only used in scenarios when there is only a single
    // metric, so the array of "previousMetrics" (meaning all the metrics
    // before the current metric), is an ampty-array
    const previousMetrics = [];
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(InlineLabel, { width: 17, as: "div" },
                React.createElement("span", null, name))),
        React.createElement(SettingsEditor, { metric: metric, previousMetrics: previousMetrics })));
};
//# sourceMappingURL=QueryEditorSpecialMetricRow.js.map