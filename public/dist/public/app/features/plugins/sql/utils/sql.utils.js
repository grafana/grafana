import { QueryEditorExpressionType, QueryEditorPropertyType, } from '../expressions';
export function createSelectClause(sqlColumns) {
    const columns = sqlColumns.map((c) => {
        var _a, _b, _c, _d;
        let rawColumn = '';
        if (c.name && c.alias) {
            rawColumn += `${c.name}(${(_a = c.parameters) === null || _a === void 0 ? void 0 : _a.map((p) => `${p.name}`)}) AS ${c.alias}`;
        }
        else if (c.name) {
            rawColumn += `${c.name}(${(_b = c.parameters) === null || _b === void 0 ? void 0 : _b.map((p) => `${p.name}`)})`;
        }
        else if (c.alias) {
            rawColumn += `${(_c = c.parameters) === null || _c === void 0 ? void 0 : _c.map((p) => `${p.name}`)} AS ${c.alias}`;
        }
        else {
            rawColumn += `${(_d = c.parameters) === null || _d === void 0 ? void 0 : _d.map((p) => `${p.name}`)}`;
        }
        return rawColumn;
    });
    return `SELECT ${columns.join(', ')} `;
}
export const haveColumns = (columns) => {
    if (!columns) {
        return false;
    }
    const haveColumn = columns.some((c) => { var _a, _b; return ((_a = c.parameters) === null || _a === void 0 ? void 0 : _a.length) || ((_b = c.parameters) === null || _b === void 0 ? void 0 : _b.some((p) => p.name)); });
    const haveFunction = columns.some((c) => c.name);
    return haveColumn || haveFunction;
};
/**
 * Creates a GroupByExpression for a specified field
 */
export function setGroupByField(field) {
    return {
        type: QueryEditorExpressionType.GroupBy,
        property: {
            type: QueryEditorPropertyType.String,
            name: field,
        },
    };
}
/**
 * Creates a PropertyExpression for a specified field
 */
export function setPropertyField(field) {
    return {
        type: QueryEditorExpressionType.Property,
        property: {
            type: QueryEditorPropertyType.String,
            name: field,
        },
    };
}
export function createFunctionField(functionName) {
    return {
        type: QueryEditorExpressionType.Function,
        name: functionName,
        parameters: [],
    };
}
//# sourceMappingURL=sql.utils.js.map