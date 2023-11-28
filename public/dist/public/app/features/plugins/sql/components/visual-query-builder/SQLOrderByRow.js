import React from 'react';
import { useSqlChange } from '../../utils/useSqlChange';
import { OrderByRow } from './OrderByRow';
export function SQLOrderByRow({ fields, query, onQueryChange, db }) {
    var _a, _b;
    const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
    let columnsWithIndices = [];
    if (fields) {
        const options = (_b = (_a = query.sql) === null || _a === void 0 ? void 0 : _a.columns) === null || _b === void 0 ? void 0 : _b.map((c, i) => {
            var _a, _b;
            const value = c.name ? `${c.name}(${(_a = c.parameters) === null || _a === void 0 ? void 0 : _a.map((p) => p.name)})` : (_b = c.parameters) === null || _b === void 0 ? void 0 : _b.map((p) => p.name);
            return {
                value,
                label: `${i + 1} - ${value}`,
            };
        });
        columnsWithIndices = [
            {
                value: '',
                label: 'Selected columns',
                options,
                expanded: true,
            },
            ...fields,
        ];
    }
    return React.createElement(OrderByRow, { sql: query.sql, onSqlChange: onSqlChange, columns: columnsWithIndices });
}
//# sourceMappingURL=SQLOrderByRow.js.map