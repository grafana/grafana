// Libraries
import React, { memo } from 'react';
import { EditorField, EditorRow } from '@grafana/experimental';
import { Input } from '@grafana/ui';
// Types
import { getNormalizedLokiQuery } from '../queryUtils';
import { LokiQueryType } from '../types';
import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryField } from './LokiQueryField';
export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props) {
    var _a;
    const { annotation, onAnnotationChange, history } = props;
    // this should never happen, but we want to keep typescript happy
    if (annotation === undefined || onAnnotationChange === undefined) {
        return null;
    }
    const onChangeQuery = (query) => {
        // the current version of annotations only stores an optional boolean
        // field `instant` to handle the instant/range switch.
        // we need to maintain compatibility for now, so we do the same.
        // we explicitly call `getNormalizedLokiQuery` to make sure `queryType`
        // is set up correctly.
        const instant = getNormalizedLokiQuery(query).queryType === LokiQueryType.Instant;
        onAnnotationChange(Object.assign(Object.assign({}, annotation), { expr: query.expr, maxLines: query.maxLines, instant }));
    };
    const queryWithRefId = {
        refId: '',
        expr: annotation.expr,
        maxLines: annotation.maxLines,
        instant: annotation.instant,
        queryType: annotation.queryType,
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(LokiQueryField, { datasource: props.datasource, query: queryWithRefId, onChange: onChangeQuery, onRunQuery: () => { }, history: history, ExtraFieldElement: React.createElement(LokiOptionFields, { lineLimitValue: ((_a = queryWithRefId === null || queryWithRefId === void 0 ? void 0 : queryWithRefId.maxLines) === null || _a === void 0 ? void 0 : _a.toString()) || '', resolution: queryWithRefId.resolution || 1, query: queryWithRefId, onRunQuery: () => { }, onChange: onChangeQuery }) })),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "Title", tooltip: 'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.' },
                React.createElement(Input, { type: "text", placeholder: "alertname", value: annotation.titleFormat, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { titleFormat: event.currentTarget.value }));
                    } })),
            React.createElement(EditorField, { label: "Tags" },
                React.createElement(Input, { type: "text", placeholder: "label1,label2", value: annotation.tagKeys, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { tagKeys: event.currentTarget.value }));
                    } })),
            React.createElement(EditorField, { label: "Text", tooltip: 'Use either the name or a pattern. For example, {{instance}} is replaced with label value for the label instance.' },
                React.createElement(Input, { type: "text", placeholder: "instance", value: annotation.textFormat, onChange: (event) => {
                        onAnnotationChange(Object.assign(Object.assign({}, annotation), { textFormat: event.currentTarget.value }));
                    } })))));
});
//# sourceMappingURL=AnnotationsQueryEditor.js.map