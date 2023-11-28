import React, { useCallback } from 'react';
import { QueryField } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
export function GraphiteTextEditor({ rawQuery }) {
    const dispatch = useDispatch();
    const updateQuery = useCallback((query) => {
        dispatch(actions.updateQuery({ query }));
    }, [dispatch]);
    const runQuery = useCallback(() => {
        dispatch(actions.runQuery());
    }, [dispatch]);
    return (React.createElement(QueryField, { query: rawQuery, onChange: updateQuery, onBlur: runQuery, onRunQuery: runQuery, placeholder: 'Enter a Graphite query (run with Shift+Enter)', portalOrigin: "graphite" }));
}
//# sourceMappingURL=GraphiteTextEditor.js.map