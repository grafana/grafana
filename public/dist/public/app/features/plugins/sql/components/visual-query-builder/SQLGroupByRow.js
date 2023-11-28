import React from 'react';
import { useSqlChange } from '../../utils/useSqlChange';
import { GroupByRow } from './GroupByRow';
export function SQLGroupByRow({ fields, query, onQueryChange, db }) {
    const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
    return React.createElement(GroupByRow, { columns: fields, sql: query.sql, onSqlChange: onSqlChange });
}
//# sourceMappingURL=SQLGroupByRow.js.map