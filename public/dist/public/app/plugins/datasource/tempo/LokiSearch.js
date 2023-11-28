import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { InlineLabel } from '@grafana/ui';
import { LokiQueryField } from '../loki/components/LokiQueryField';
import { getDS } from './utils';
export function LokiSearch({ logsDatasourceUid, onChange, onRunQuery, query }) {
    var _a;
    const dsState = useAsync(() => getDS(logsDatasourceUid), [logsDatasourceUid]);
    if (dsState.loading) {
        return null;
    }
    const ds = dsState.value;
    if (ds) {
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineLabel, null,
                "Tempo uses ",
                ds.name,
                " to find traces."),
            React.createElement(LokiQueryField, { datasource: ds, onChange: onChange, onRunQuery: onRunQuery, query: (_a = query.linkedQuery) !== null && _a !== void 0 ? _a : { refId: 'linked' }, history: [] })));
    }
    if (!logsDatasourceUid) {
        return React.createElement("div", { className: "text-warning" }, "Please set up a Loki search datasource in the datasource settings.");
    }
    if (logsDatasourceUid && !ds) {
        return (React.createElement("div", { className: "text-warning" }, "Loki search datasource is configured but the data source no longer exists. Please configure existing data source to use the search."));
    }
    return null;
}
//# sourceMappingURL=LokiSearch.js.map