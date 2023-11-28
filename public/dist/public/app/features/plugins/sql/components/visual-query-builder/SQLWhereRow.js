import { __awaiter } from "tslib";
import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { getTemplateSrv } from '@grafana/runtime';
import { useSqlChange } from '../../utils/useSqlChange';
import { WhereRow } from './WhereRow';
export function SQLWhereRow({ query, fields, onQueryChange, db }) {
    const state = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        return mapFieldsToTypes(fields);
    }), [fields]);
    const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
    return (React.createElement(WhereRow
    // TODO: fix key that's used to force clean render or SQLWhereRow - otherwise it doesn't render operators correctly
    , { 
        // TODO: fix key that's used to force clean render or SQLWhereRow - otherwise it doesn't render operators correctly
        key: JSON.stringify(state.value), config: { fields: state.value || {} }, sql: query.sql, onSqlChange: (val) => {
            const templateVars = getTemplateSrv().getVariables();
            removeQuotesForMultiVariables(val, templateVars);
            onSqlChange(val);
        } }));
}
// needed for awesome query builder
function mapFieldsToTypes(columns) {
    const fields = {};
    for (const col of columns) {
        fields[col.value] = {
            type: col.raqbFieldType || 'text',
            valueSources: ['value'],
            mainWidgetProps: { customProps: { icon: col.icon } },
        };
    }
    return fields;
}
export function removeQuotesForMultiVariables(val, templateVars) {
    var _a, _b;
    const multiVariableInWhereString = (tv) => { var _a, _b; return tv.multi && (((_a = val.whereString) === null || _a === void 0 ? void 0 : _a.includes(`\${${tv.name}}`)) || ((_b = val.whereString) === null || _b === void 0 ? void 0 : _b.includes(`$${tv.name}`))); };
    if (templateVars.some((tv) => multiVariableInWhereString(tv))) {
        val.whereString = (_a = val.whereString) === null || _a === void 0 ? void 0 : _a.replaceAll("')", ')');
        val.whereString = (_b = val.whereString) === null || _b === void 0 ? void 0 : _b.replaceAll("('", '(');
    }
}
//# sourceMappingURL=SQLWhereRow.js.map