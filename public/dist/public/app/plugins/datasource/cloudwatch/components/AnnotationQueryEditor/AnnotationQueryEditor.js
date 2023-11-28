import React from 'react';
import { EditorField, EditorHeader, EditorRow, EditorSwitch, InlineSelect, Space } from '@grafana/experimental';
import { Alert, Input } from '@grafana/ui';
import { isCloudWatchAnnotationQuery } from '../../guards';
import { useRegions } from '../../hooks';
import { MetricStatEditor } from '../shared/MetricStatEditor/MetricStatEditor';
// Dashboard Settings -> Annotations -> New Query
export const AnnotationQueryEditor = (props) => {
    const { query, onChange, datasource } = props;
    const [regions, regionIsLoading] = useRegions(datasource);
    if (!isCloudWatchAnnotationQuery(query)) {
        return (React.createElement(Alert, { severity: "error", title: "Invalid annotation query", topSpacing: 2 }, JSON.stringify(query, null, 4)));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorHeader, null,
            React.createElement(InlineSelect, { label: "Region", value: regions.find((v) => v.value === query.region), placeholder: "Select region", allowCustomValue: true, onChange: ({ value: region }) => region && onChange(Object.assign(Object.assign({}, query), { region })), options: regions, isLoading: regionIsLoading })),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(MetricStatEditor, Object.assign({}, props, { refId: query.refId, metricStat: query, disableExpressions: true, onChange: (metricStat) => onChange(Object.assign(Object.assign({}, query), metricStat)) })),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Period", width: 26, tooltip: "Minimum interval between points in seconds." },
                React.createElement(Input, { value: query.period || '', placeholder: "auto", onChange: (event) => onChange(Object.assign(Object.assign({}, query), { period: event.target.value })) })),
            React.createElement(EditorField, { label: "Enable Prefix Matching", optional: true },
                React.createElement(EditorSwitch, { value: query.prefixMatching, onChange: (e) => {
                        onChange(Object.assign(Object.assign({}, query), { prefixMatching: e.currentTarget.checked }));
                    } })),
            React.createElement(EditorField, { label: "Action", optional: true, disabled: !query.prefixMatching },
                React.createElement(Input, { value: query.actionPrefix || '', onChange: (event) => onChange(Object.assign(Object.assign({}, query), { actionPrefix: event.target.value })) })),
            React.createElement(EditorField, { label: "Alarm Name", optional: true, disabled: !query.prefixMatching },
                React.createElement(Input, { value: query.alarmNamePrefix || '', onChange: (event) => onChange(Object.assign(Object.assign({}, query), { alarmNamePrefix: event.target.value })) })))));
};
//# sourceMappingURL=AnnotationQueryEditor.js.map