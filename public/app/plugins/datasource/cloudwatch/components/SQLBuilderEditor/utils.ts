import { SelectableValue } from '@grafana/data';

import { SCHEMA } from '../../cloudwatch-sql/language';
import {
  QueryEditorExpressionType,
  QueryEditorPropertyType,
  QueryEditorFunctionParameterExpression,
  QueryEditorArrayExpression,
  QueryEditorOperatorExpression,
  QueryEditorGroupByExpression,
} from '../../expressions';
import { SQLExpression, CloudWatchMetricsQuery, Dimensions } from '../../types';

export function getMetricNameFromExpression(selectExpression: SQLExpression['select']): string | undefined {
  return selectExpression?.parameters?.[0].name;
}

export function getNamespaceFromExpression(fromExpression: SQLExpression['from']): string | undefined {
  // It's just a simple `FROM "AWS/EC2"` expression
  if (fromExpression?.type === QueryEditorExpressionType.Property) {
    return fromExpression.property.name; // PR TODO: do we need to test the type here? It can only be string?
  }

  // It's a more complicated `FROM SCHEMA("AWS/EC2", ...)` expression
  if (fromExpression?.type === QueryEditorExpressionType.Function) {
    // TODO: do we need to test the name of the function?
    return fromExpression.parameters?.[0].name;
  }

  return undefined;
}

export function getSchemaLabelKeys(fromExpression: SQLExpression['from']): string[] | undefined {
  // Schema label keys are second to n arguments in the from expression function
  if (fromExpression?.type === QueryEditorExpressionType.Function && fromExpression?.parameters?.length) {
    if (fromExpression?.parameters?.length <= 1) {
      return [];
    }

    // ignore the first arg (the namespace)
    const paramExpressions = fromExpression?.parameters.slice(1);
    return paramExpressions.reduce<string[]>((acc, curr) => (curr.name ? [...acc, curr.name] : acc), []);
  }

  return undefined;
}

export function isUsingWithSchema(fromExpression: SQLExpression['from']): boolean {
  return fromExpression?.type === QueryEditorExpressionType.Function && fromExpression.name === SCHEMA;
}

/** Given a partial operator expression, return a non-partial if it's valid, or undefined */
export function sanitizeOperator(
  expression: Partial<QueryEditorOperatorExpression>
): QueryEditorOperatorExpression | undefined {
  const key = expression.property?.name;
  const value = expression.operator?.value;
  const operator = expression.operator?.name;

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
function flattenOperatorExpressions(
  expressions: QueryEditorArrayExpression['expressions']
): QueryEditorOperatorExpression[] {
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
export function getFlattenedFilters(sql: SQLExpression): QueryEditorOperatorExpression[] {
  const where = sql.where;
  return flattenOperatorExpressions(where?.expressions ?? []);
}

/**
 * Given an array of Expressions, flattens them to the leaf Operator expressions.
 * Note, this loses context of any nested ANDs or ORs, so will not be useful once we support nested conditions */
function flattenGroupByExpressions(
  expressions: QueryEditorArrayExpression['expressions']
): QueryEditorGroupByExpression[] {
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
export function getFlattenedGroupBys(sql: SQLExpression): QueryEditorGroupByExpression[] {
  const groupBy = sql.groupBy;
  return flattenGroupByExpressions(groupBy?.expressions ?? []);
}

/** Converts a string array to a Dimensions object with null values  **/
export function stringArrayToDimensions(arr: string[]): Dimensions {
  return arr.reduce((acc, curr) => {
    if (curr) {
      return { ...acc, [curr]: null };
    }
    return acc;
  }, {});
}

export function setSql(query: CloudWatchMetricsQuery, sql: SQLExpression): CloudWatchMetricsQuery {
  return {
    ...query,
    sql: {
      ...(query.sql ?? {}),
      ...sql,
    },
  };
}

export function setNamespace(query: CloudWatchMetricsQuery, namespace: string | undefined): CloudWatchMetricsQuery {
  const sql = query.sql ?? {};
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
    const namespaceParam: QueryEditorFunctionParameterExpression = {
      type: QueryEditorExpressionType.FunctionParameter,
      name: namespace,
    };

    const labelKeys = (sql.from.parameters ?? []).slice(1);

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

export function setSchemaLabels(
  query: CloudWatchMetricsQuery,
  schemaLabels: Array<SelectableValue<string>> | SelectableValue<string>
): CloudWatchMetricsQuery {
  const sql = query.sql ?? {};
  schemaLabels = Array.isArray(schemaLabels) ? schemaLabels.map((l) => l.value) : [schemaLabels.value];

  // schema labels are the second parameter in the schema function. `... FROM SCHEMA("AWS/EC2", label1, label2 ...)`
  if (sql.from?.type === QueryEditorExpressionType.Function && sql.from.parameters?.length) {
    const parameters: QueryEditorFunctionParameterExpression[] = (schemaLabels ?? []).map((label: string) => ({
      type: QueryEditorExpressionType.FunctionParameter,
      name: label,
    }));
    const namespaceParam = (sql.from.parameters ?? [])[0];

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

export function setMetricName(query: CloudWatchMetricsQuery, metricName: string): CloudWatchMetricsQuery {
  const param: QueryEditorFunctionParameterExpression = {
    type: QueryEditorExpressionType.FunctionParameter,
    name: metricName,
  };

  return setSql(query, {
    select: {
      type: QueryEditorExpressionType.Function,
      ...(query.sql?.select ?? {}),
      parameters: [param],
    },
  });
}

export function removeMetricName(query: CloudWatchMetricsQuery): CloudWatchMetricsQuery {
  const queryWithNoParams = { ...query };
  delete queryWithNoParams.sql?.select?.parameters;

  return queryWithNoParams;
}

export function setAggregation(query: CloudWatchMetricsQuery, aggregation: string): CloudWatchMetricsQuery {
  return setSql(query, {
    select: {
      type: QueryEditorExpressionType.Function,
      ...(query.sql?.select ?? {}),
      name: aggregation,
    },
  });
}

export function setOrderBy(query: CloudWatchMetricsQuery, aggregation: string): CloudWatchMetricsQuery {
  return setSql(query, {
    orderBy: {
      type: QueryEditorExpressionType.Function,
      name: aggregation,
    },
  });
}

export function setWithSchema(query: CloudWatchMetricsQuery, withSchema: boolean): CloudWatchMetricsQuery {
  const namespace = getNamespaceFromExpression((query.sql ?? {}).from);

  if (withSchema) {
    const namespaceParam: QueryEditorFunctionParameterExpression = {
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
export function setOperatorExpressionProperty(
  expression: Partial<QueryEditorOperatorExpression>,
  property: string
): QueryEditorOperatorExpression {
  return {
    type: QueryEditorExpressionType.Operator,
    property: {
      type: QueryEditorPropertyType.String,
      name: property,
    },
    operator: expression.operator ?? {},
  };
}

/** Sets the operator ("==") in an OperatorExpression
 * Accepts a partial expression to use in an editor
 */
export function setOperatorExpressionName(
  expression: Partial<QueryEditorOperatorExpression>,
  name: string
): QueryEditorOperatorExpression {
  return {
    type: QueryEditorExpressionType.Operator,
    property: expression.property ?? {
      type: QueryEditorPropertyType.String,
    },
    operator: {
      ...expression.operator,
      name,
    },
  };
}

/** Sets the right hand side ("i-abc123445") in an OperatorExpression
 * Accepts a partial expression to use in an editor
 */
export function setOperatorExpressionValue(
  expression: Partial<QueryEditorOperatorExpression>,
  value: string
): QueryEditorOperatorExpression {
  return {
    type: QueryEditorExpressionType.Operator,
    property: expression.property ?? {
      type: QueryEditorPropertyType.String,
    },
    operator: {
      ...expression.operator,
      value,
    },
  };
}

/** Creates a GroupByExpression for a specified field
 */
export function setGroupByField(field: string): QueryEditorGroupByExpression {
  return {
    type: QueryEditorExpressionType.GroupBy,
    property: {
      type: QueryEditorPropertyType.String,
      name: field,
    },
  };
}
