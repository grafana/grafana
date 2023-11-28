import React from 'react';
import { toOption } from '@grafana/data';
import { COMMON_AGGREGATE_FNS } from '../../constants';
import { useSqlChange } from '../../utils/useSqlChange';
import { SelectRow } from './SelectRow';
export function SQLSelectRow({ fields, query, onQueryChange, db }) {
    var _a;
    const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
    const functions = [...COMMON_AGGREGATE_FNS, ...(((_a = db.functions) === null || _a === void 0 ? void 0 : _a.call(db)) || [])].map(toOption);
    return (React.createElement(SelectRow, { columns: fields, sql: query.sql, format: query.format, functions: functions, onSqlChange: onSqlChange }));
}
//# sourceMappingURL=SQLSelectRow.js.map