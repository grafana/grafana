import React from 'react';
import { EditorField, EditorRow, EditorRows, EditorSwitch, Space } from '@grafana/experimental';
import { AutoSizeInput, Input } from '@grafana/ui';
import { PromQueryCodeEditor } from '../querybuilder/components/PromQueryCodeEditor';
export function AnnotationQueryEditor(props) {
    // This is because of problematic typing. See AnnotationQueryEditorProps in grafana-data/annotations.ts.
    const annotation = props.annotation;
    const onAnnotationChange = props.onAnnotationChange;
    const query = { expr: annotation.expr, refId: annotation.name, interval: annotation.step };
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRows, null,
            React.createElement(PromQueryCodeEditor, Object.assign({}, props, { query: query, showExplain: false, onChange: (query) => {
                    onAnnotationChange(Object.assign(Object.assign({}, annotation), { expr: query.expr }));
                } })),
            React.createElement(EditorRow, null,
                React.createElement(EditorField, { label: "Min step", tooltip: React.createElement(React.Fragment, null,
                        "An additional lower limit for the step parameter of the Prometheus query and for the",
                        ' ',
                        React.createElement("code", null, "$__interval"),
                        " and ",
                        React.createElement("code", null, "$__rate_interval"),
                        " variables.") },
                    React.createElement(AutoSizeInput, { type: "text", "aria-label": "Set lower limit for the step parameter", placeholder: 'auto', minWidth: 10, onCommitChange: (ev) => {
                            onAnnotationChange(Object.assign(Object.assign({}, annotation), { step: ev.currentTarget.value }));
                        }, defaultValue: query.interval })))),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Title", tooltip: 'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.' },
                React.createElement(Input, { type: "text", placeholder: "{{alertname}}", value: annotation.titleFormat, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { titleFormat: event.currentTarget.value }));
                    } })),
            React.createElement(EditorField, { label: "Tags" },
                React.createElement(Input, { type: "text", placeholder: "label1,label2", value: annotation.tagKeys, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { tagKeys: event.currentTarget.value }));
                    } })),
            React.createElement(EditorField, { label: "Text", tooltip: 'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.' },
                React.createElement(Input, { type: "text", placeholder: "{{instance}}", value: annotation.textFormat, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { textFormat: event.currentTarget.value }));
                    } })),
            React.createElement(EditorField, { label: "Series value as timestamp", tooltip: 'The unit of timestamp is milliseconds. If the unit of the series value is seconds, multiply its range vector by 1000.' },
                React.createElement(EditorSwitch, { value: annotation.useValueForTime, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { useValueForTime: event.currentTarget.value }));
                    } })))));
}
//# sourceMappingURL=AnnotationQueryEditor.js.map