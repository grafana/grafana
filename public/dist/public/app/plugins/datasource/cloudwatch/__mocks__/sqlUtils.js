import { QueryEditorExpressionType, QueryEditorPropertyType, } from '../expressions';
export function createArray(expressions, type = QueryEditorExpressionType.And) {
    const array = {
        type,
        expressions,
    };
    return array;
}
export function createOperator(property, operator, value) {
    return {
        type: QueryEditorExpressionType.Operator,
        property: {
            name: property,
            type: QueryEditorPropertyType.String,
        },
        operator: {
            name: operator,
            value: value,
        },
    };
}
export function createGroupBy(column) {
    return {
        type: QueryEditorExpressionType.GroupBy,
        property: {
            type: QueryEditorPropertyType.String,
            name: column,
        },
    };
}
export function createFunction(name) {
    return {
        type: QueryEditorExpressionType.Function,
        name,
    };
}
export function createFunctionWithParameter(functionName, params) {
    const reduce = createFunction(functionName);
    reduce.parameters = params.map((name) => {
        const param = {
            type: QueryEditorExpressionType.FunctionParameter,
            name,
        };
        return param;
    });
    return reduce;
}
export function createProperty(name) {
    return {
        type: QueryEditorExpressionType.Property,
        property: {
            type: QueryEditorPropertyType.String,
            name: name,
        },
    };
}
//# sourceMappingURL=sqlUtils.js.map