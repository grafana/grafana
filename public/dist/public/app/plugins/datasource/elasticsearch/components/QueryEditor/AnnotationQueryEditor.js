import React from 'react';
import { EditorField, EditorRow } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import { ElasticSearchQueryField } from './index';
export function ElasticsearchAnnotationsQueryEditor(props) {
    var _a;
    const annotation = props.annotation;
    const onAnnotationChange = props.onAnnotationChange;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(ElasticSearchQueryField, { value: (_a = annotation.target) === null || _a === void 0 ? void 0 : _a.query, onChange: (query) => {
                    var _a;
                    const currentTarget = (_a = annotation.target) !== null && _a !== void 0 ? _a : { refId: 'annotation_query' };
                    const newTarget = Object.assign(Object.assign({}, currentTarget), { query });
                    onAnnotationChange(Object.assign(Object.assign({}, annotation), { target: newTarget }));
                } })),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("h6", null, "Field mappings"),
            React.createElement(EditorRow, null,
                React.createElement(EditorField, { label: "Time" },
                    React.createElement(Input, { type: "text", placeholder: "@timestamp", value: annotation.timeField, onChange: (e) => {
                            onAnnotationChange(Object.assign(Object.assign({}, annotation), { timeField: e.currentTarget.value }));
                        } })),
                React.createElement(EditorField, { label: "Time End" },
                    React.createElement(Input, { type: "text", value: annotation.timeEndField, onChange: (e) => {
                            onAnnotationChange(Object.assign(Object.assign({}, annotation), { timeEndField: e.currentTarget.value }));
                        } })),
                React.createElement(EditorField, { label: "Text" },
                    React.createElement(Input, { type: "text", value: annotation.textField, onChange: (e) => {
                            onAnnotationChange(Object.assign(Object.assign({}, annotation), { textField: e.currentTarget.value }));
                        } })),
                React.createElement(EditorField, { label: "Tags" },
                    React.createElement(Input, { type: "text", placeholder: "tags", value: annotation.tagsField, onChange: (e) => {
                            onAnnotationChange(Object.assign(Object.assign({}, annotation), { tagsField: e.currentTarget.value }));
                        } }))))));
}
//# sourceMappingURL=AnnotationQueryEditor.js.map