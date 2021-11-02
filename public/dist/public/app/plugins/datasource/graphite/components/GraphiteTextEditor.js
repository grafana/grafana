import React, { useCallback } from 'react';
import { QueryField } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
export function GraphiteTextEditor(_a) {
    var rawQuery = _a.rawQuery;
    var dispatch = useDispatch();
    var updateQuery = useCallback(function (query) {
        dispatch(actions.updateQuery({ query: query }));
    }, [dispatch]);
    var runQuery = useCallback(function () {
        dispatch(actions.runQuery());
    }, [dispatch]);
    return (React.createElement(QueryField, { query: rawQuery, onChange: updateQuery, onBlur: runQuery, onRunQuery: runQuery, placeholder: 'Enter a Graphite query (run with Shift+Enter)', portalOrigin: "graphite" }));
}
//# sourceMappingURL=GraphiteTextEditor.js.map