import { QueryEditorExpressionType, QueryEditorPropertyType, } from '../../../../expressions';
import { SCHEMA } from '../../../../language/cloudwatch-sql/language';
export function getMetricNameFromExpression(selectExpression) {
    var _a;
    return (_a = selectExpression === null || selectExpression === void 0 ? void 0 : selectExpression.parameters) === null || _a === void 0 ? void 0 : _a[0].name;
}
export function getNamespaceFromExpression(fromExpression) {
    var _a;
    // It's just a simple `FROM "AWS/EC2"` expression
    if ((fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.type) === QueryEditorExpressionType.Property) {
        return fromExpression.property.name; // PR TODO: do we need to test the type here? It can only be string?
    }
    // It's a more complicated `FROM SCHEMA("AWS/EC2", ...)` expression
    if ((fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.type) === QueryEditorExpressionType.Function) {
        // TODO: do we need to test the name of the function?
        return (_a = fromExpression.parameters) === null || _a === void 0 ? void 0 : _a[0].name;
    }
    return undefined;
}
export function getSchemaLabelKeys(fromExpression) {
    var _a, _b;
    // Schema label keys are second to n arguments in the from expression function
    if ((fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.type) === QueryEditorExpressionType.Function && ((_a = fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.parameters) === null || _a === void 0 ? void 0 : _a.length)) {
        if (((_b = fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.parameters) === null || _b === void 0 ? void 0 : _b.length) <= 1) {
            return [];
        }
        // ignore the first arg (the namespace)
        const paramExpressions = fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.parameters.slice(1);
        return paramExpressions.reduce((acc, curr) => (curr.name ? [...acc, curr.name] : acc), []);
    }
    return undefined;
}
export function isUsingWithSchema(fromExpression) {
    return (fromExpression === null || fromExpression === void 0 ? void 0 : fromExpression.type) === QueryEditorExpressionType.Function && fromExpression.name === SCHEMA;
}
/** Given a partial operator expression, return a non-partial if it's valid, or undefined */
export function sanitizeOperator(expression) {
    var _a, _b, _c;
    const key = (_a = expression.property) === null || _a === void 0 ? void 0 : _a.name;
    const value = (_b = expression.operator) === null || _b === void 0 ? void 0 : _b.value;
    const operator = (_c = expression.operator) === null || _c === void 0 ? void 0 : _c.name;
    if (key && value && operator) {
        return {
            type: QueryEditorExpressionType.Operator,
            property: {
                type: QueryEditorPropertyType.String,
                name: key,
            },
            operator: {
                value,
                name: operator,
            },
        };
    }
    return undefined;
}
/**
 * Given an array of Expressions, flattens them to the leaf Operator expressions.
 * Note, this loses context of any nested ANDs or ORs, so will not be useful once we support nested conditions */
function flattenOperatorExpressions(expressions) {
    return expressions.flatMap((expression) => {
        if (expression.type === QueryEditorExpressionType.Operator) {
            return expression;
        }
        if (expression.type === QueryEditorExpressionType.And || expression.type === QueryEditorExpressionType.Or) {
            return flattenOperatorExpressions(expression.expressions);
        }
        // Expressions that we don't expect to find in the WHERE filter will be ignored
        return [];
    });
}
/** Returns a flattened list of WHERE filters, losing all context of nested filters or AND vs OR. Not suitable
 * if the UI supports nested conditions
 */
export function getFlattenedFilters(sql) {
    var _a;
    const where = sql.where;
    return flattenOperatorExpressions((_a = where === null || where === void 0 ? void 0 : where.expressions) !== null && _a !== void 0 ? _a : []);
}
/**
 * Given an array of Expressions, flattens them to the leaf Operator expressions.
 * Note, this loses context of any nested ANDs or ORs, so will not be useful once we support nested conditions */
function flattenGroupByExpressions(expressions) {
    return expressions.flatMap((expression) => {
        if (expression.type === QueryEditorExpressionType.GroupBy) {
            return expression;
        }
        // Expressions that we don't expect to find in the GROUP BY will be ignored
        return [];
    });
}
/** Returns a flattened list of GROUP BY expressions, losing all context of nested filters or AND vs OR.
 */
export function getFlattenedGroupBys(sql) {
    var _a;
    const groupBy = sql.groupBy;
    return flattenGroupByExpressions((_a = groupBy === null || groupBy === void 0 ? void 0 : groupBy.expressions) !== null && _a !== void 0 ? _a : []);
}
/** Converts a string array to a Dimensions object with null values  **/
export function stringArrayToDimensions(arr) {
    return arr.reduce((acc, curr) => {
        if (curr) {
            return Object.assign(Object.assign({}, acc), { [curr]: null });
        }
        return acc;
    }, {});
}
export function setSql(query, sql) {
    var _a;
    return Object.assign(Object.assign({}, query), { sql: Object.assign(Object.assign({}, ((_a = query.sql) !== null && _a !== void 0 ? _a : {})), sql) });
}
export function setNamespace(query, namespace) {
    var _a, _b;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    //updating `namespace` props for CloudWatchMetricsQuery
    query.namespace = namespace ? namespace : '';
    if (namespace === undefined) {
        return setSql(query, {
            from: undefined,
        });
    }
    // It's just a simple `FROM "AWS/EC2"` expression
    if (!sql.from || sql.from.type === QueryEditorExpressionType.Property) {
        return setSql(query, {
            from: {
                type: QueryEditorExpressionType.Property,
                property: {
                    type: QueryEditorPropertyType.String,
                    name: namespace,
                },
            },
        });
    }
    // It's a more complicated `FROM SCHEMA("AWS/EC2", ...)` expression
    if (sql.from.type === QueryEditorExpressionType.Function) {
        const namespaceParam = {
            type: QueryEditorExpressionType.FunctionParameter,
            name: namespace,
        };
        const labelKeys = ((_b = sql.from.parameters) !== null && _b !== void 0 ? _b : []).slice(1);
        return setSql(query, {
            from: {
                type: QueryEditorExpressionType.Function,
                name: SCHEMA,
                parameters: [namespaceParam, ...labelKeys],
            },
        });
    }
    // TODO: do the with schema bit
    return query;
}
export function setSchemaLabels(query, schemaLabels) {
    var _a, _b, _c, _d;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    schemaLabels = Array.isArray(schemaLabels) ? schemaLabels.map((l) => l.value) : [schemaLabels.value];
    // schema labels are the second parameter in the schema function. `... FROM SCHEMA("AWS/EC2", label1, label2 ...)`
    if (((_b = sql.from) === null || _b === void 0 ? void 0 : _b.type) === QueryEditorExpressionType.Function && ((_c = sql.from.parameters) === null || _c === void 0 ? void 0 : _c.length)) {
        const parameters = (schemaLabels !== null && schemaLabels !== void 0 ? schemaLabels : []).map((label) => ({
            type: QueryEditorExpressionType.FunctionParameter,
            name: label,
        }));
        const namespaceParam = ((_d = sql.from.parameters) !== null && _d !== void 0 ? _d : [])[0];
        return setSql(query, {
            from: {
                type: QueryEditorExpressionType.Function,
                name: SCHEMA,
                parameters: [namespaceParam, ...parameters],
            },
        });
    }
    return query;
}
export function setMetricName(query, metricName) {
    var _a, _b;
    const param = {
        type: QueryEditorExpressionType.FunctionParameter,
        name: metricName,
    };
    return setSql(query, {
        select: Object.assign(Object.assign({ type: QueryEditorExpressionType.Function }, ((_b = (_a = query.sql) === null || _a === void 0 ? void 0 : _a.select) !== null && _b !== void 0 ? _b : {})), { parameters: [param] }),
    });
}
export function removeMetricName(query) {
    var _a, _b;
    const queryWithNoParams = Object.assign({}, query);
    (_b = (_a = queryWithNoParams.sql) === null || _a === void 0 ? void 0 : _a.select) === null || _b === void 0 ? true : delete _b.parameters;
    return queryWithNoParams;
}
export function setAggregation(query, aggregation) {
    var _a, _b;
    return setSql(query, {
        select: Object.assign(Object.assign({ type: QueryEditorExpressionType.Function }, ((_b = (_a = query.sql) === null || _a === void 0 ? void 0 : _a.select) !== null && _b !== void 0 ? _b : {})), { name: aggregation }),
    });
}
export function setOrderBy(query, aggregation) {
    return setSql(query, {
        orderBy: {
            type: QueryEditorExpressionType.Function,
            name: aggregation,
        },
    });
}
export function setWithSchema(query, withSchema) {
    var _a;
    const namespace = getNamespaceFromExpression(((_a = query.sql) !== null && _a !== void 0 ? _a : {}).from);
    if (withSchema) {
        const namespaceParam = {
            type: QueryEditorExpressionType.FunctionParameter,
            name: namespace,
        };
        return setSql(query, {
            from: {
                type: QueryEditorExpressionType.Function,
                name: SCHEMA,
                parameters: [namespaceParam],
            },
        });
    }
    return setSql(query, {
        from: {
            type: QueryEditorExpressionType.Property,
            property: {
                type: QueryEditorPropertyType.String,
                name: namespace,
            },
        },
    });
}
/** Sets the left hand side (InstanceId) in an OperatorExpression
 * Accepts a partial expression to use in an editor
 */
export function setOperatorExpressionProperty(expression, property) {
    var _a;
    return {
        type: QueryEditorExpressionType.Operator,
        property: {
            type: QueryEditorPropertyType.String,
            name: property,
        },
        operator: (_a = expression.operator) !== null && _a !== void 0 ? _a : {},
    };
}
/** Sets the operator ("==") in an OperatorExpression
 * Accepts a partial expression to use in an editor
 */
export function setOperatorExpressionName(expression, name) {
    var _a;
    return {
        type: QueryEditorExpressionType.Operator,
        property: (_a = expression.property) !== null && _a !== void 0 ? _a : {
            type: QueryEditorPropertyType.String,
        },
        operator: Object.assign(Object.assign({}, expression.operator), { name }),
    };
}
/** Sets the right hand side ("i-abc123445") in an OperatorExpression
 * Accepts a partial expression to use in an editor
 */
export function setOperatorExpressionValue(expression, value) {
    var _a;
    return {
        type: QueryEditorExpressionType.Operator,
        property: (_a = expression.property) !== null && _a !== void 0 ? _a : {
            type: QueryEditorPropertyType.String,
        },
        operator: Object.assign(Object.assign({}, expression.operator), { value }),
    };
}
/** Creates a GroupByExpression for a specified field
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
//# sourceMappingURL=utils.js.map