import { useCallback } from 'react';
export function useSqlChange({ query, onQueryChange, db }) {
    const onSqlChange = useCallback((sql) => {
        const toRawSql = db.toRawSql;
        const rawSql = toRawSql({ sql, dataset: query.dataset, table: query.table, refId: query.refId });
        const newQuery = Object.assign(Object.assign({}, query), { sql, rawSql });
        onQueryChange(newQuery);
    }, [db, onQueryChange, query]);
    return { onSqlChange };
}
//# sourceMappingURL=useSqlChange.js.map