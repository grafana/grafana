// Libraries
import React, { memo } from 'react';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';
export function LokiExploreQueryEditor(props) {
    var _a;
    var query = props.query, data = props.data, datasource = props.datasource, history = props.history, onChange = props.onChange, onRunQuery = props.onRunQuery, range = props.range;
    return (React.createElement(LokiQueryField, { datasource: datasource, query: query, onChange: onChange, onBlur: function () { }, onRunQuery: onRunQuery, history: history, data: data, range: range, ExtraFieldElement: React.createElement(LokiOptionFields, { queryType: query.instant ? 'instant' : 'range', lineLimitValue: ((_a = query === null || query === void 0 ? void 0 : query.maxLines) === null || _a === void 0 ? void 0 : _a.toString()) || '', resolution: query.resolution || 1, query: query, onRunQuery: onRunQuery, onChange: onChange }) }));
}
export default memo(LokiExploreQueryEditor);
//# sourceMappingURL=LokiExploreQueryEditor.js.map