import { css } from '@emotion/css';
import React from 'react';
import { buildRawQuery } from '../../../queryUtils';
import { InfluxVersion } from '../../../types';
import { FluxQueryEditor } from './flux/FluxQueryEditor';
import { FSQLEditor } from './fsql/FSQLEditor';
import { QueryEditorModeSwitcher } from './influxql/QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './influxql/code/RawInfluxQLEditor';
import { VisualInfluxQLEditor as VisualInfluxQLEditor } from './influxql/visual/VisualInfluxQLEditor';
export const QueryEditor = ({ query, onChange, onRunQuery, datasource }) => {
    var _a;
    switch (datasource.version) {
        case InfluxVersion.Flux:
            return (React.createElement("div", { className: "gf-form-query-content" },
                React.createElement(FluxQueryEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource })));
        case InfluxVersion.SQL:
            return React.createElement(FSQLEditor, { datasource: datasource, query: query, onChange: onChange, onRunQuery: onRunQuery });
        case InfluxVersion.InfluxQL:
        default:
            return (React.createElement("div", { className: css({ display: 'flex' }) },
                React.createElement("div", { className: css({ flexGrow: 1 }) }, query.rawQuery ? (React.createElement(RawInfluxQLEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery })) : (React.createElement(VisualInfluxQLEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource }))),
                React.createElement(QueryEditorModeSwitcher, { isRaw: (_a = query.rawQuery) !== null && _a !== void 0 ? _a : false, onChange: (value) => {
                        onChange(Object.assign(Object.assign({}, query), { query: buildRawQuery(query), rawQuery: value }));
                        onRunQuery();
                    } })));
    }
};
//# sourceMappingURL=QueryEditor.js.map