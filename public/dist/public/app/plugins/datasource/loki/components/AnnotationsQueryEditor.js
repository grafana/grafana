// Libraries
import React, { memo } from 'react';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';
export var LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props) {
    var _a;
    var expr = props.expr, maxLines = props.maxLines, instant = props.instant, datasource = props.datasource, onChange = props.onChange;
    var queryWithRefId = {
        refId: '',
        expr: expr,
        maxLines: maxLines,
        instant: instant,
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement(LokiQueryField, { datasource: datasource, query: queryWithRefId, onChange: onChange, onRunQuery: function () { }, onBlur: function () { }, history: [], ExtraFieldElement: React.createElement(LokiOptionFields, { queryType: queryWithRefId.instant ? 'instant' : 'range', lineLimitValue: ((_a = queryWithRefId === null || queryWithRefId === void 0 ? void 0 : queryWithRefId.maxLines) === null || _a === void 0 ? void 0 : _a.toString()) || '', resolution: queryWithRefId.resolution || 1, query: queryWithRefId, onRunQuery: function () { }, onChange: onChange }) })));
});
//# sourceMappingURL=AnnotationsQueryEditor.js.map