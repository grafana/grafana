import { escapeRegExp } from "lodash";

import { SelectableValue } from "@grafana/data";

import { AzureLogAnalyticsMetadataColumn } from "../../types";

import { AggregateFunctions } from "./AggregateItem";

const DYNAMIC_TYPE_ARRAY_DELIMITER = '["`indexer`"]';
export const valueToDefinition = (name: string) => {
    return {
        value: name,
        label: name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
    };
};

export const OPERATORS_BY_TYPE: Record<string, Array<SelectableValue<string>>> = {
    string: [
        { label: '==', value: '==' },
        { label: '!=', value: '!=' },
        { label: 'contains', value: 'contains' },
        { label: '!contains', value: '!contains' },
        { label: 'startswith', value: 'startswith' },
        { label: 'endswith', value: 'endswith' },
    ],
    int: [
        { label: '==', value: '==' },
        { label: '!=', value: '!=' },
        { label: '>', value: '>' },
        { label: '<', value: '<' },
        { label: '>=', value: '>=' },
        { label: '<=', value: '<=' },
    ],
    datetime: [
        { label: 'before', value: '<' },
        { label: 'after', value: '>' },
        { label: 'between', value: 'between' },
    ],
    bool: [
        { label: '==', value: '==' },
        { label: '!=', value: '!=' },
    ],
};
  
export const toOperatorOptions = (type: string): Array<SelectableValue<string>> => {
    return OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.string;
};  

export enum QueryEditorPropertyType {
    Number = 'number',
    String = 'string',
    Boolean = 'boolean',
    DateTime = 'dateTime',
    TimeSpan = 'timeSpan',
    Function = 'function',
    Interval = 'interval',
}
  
export enum QueryEditorExpressionType {
    Property = 'property',
    Operator = 'operator',
    Reduce = 'reduce',
    FunctionParameter = 'functionParameter',
    GroupBy = 'groupBy',
    Or = 'or',
    And = 'and',
}

export interface QueryEditorProperty {
    type: QueryEditorPropertyType;
    name: string;
}

export interface QueryEditorExpression {
    type: QueryEditorExpressionType;
}

export interface QueryEditorFunctionParameterExpression extends QueryEditorExpression {
    value: string;
    fieldType: QueryEditorPropertyType;
    name: string;
}

export interface QueryEditorReduceExpression extends QueryEditorExpression {
    property: QueryEditorProperty;
    reduce: QueryEditorProperty;
    parameters?: QueryEditorFunctionParameterExpression[];
    focus?: boolean;
}

/** Given a partial aggregation expression, return a non-partial if it's valid, or undefined */
export function sanitizeAggregate(expression: QueryEditorReduceExpression): QueryEditorReduceExpression | undefined {
    const func = expression.reduce?.name;
    const column = expression.property?.name;

    if (func) {
        switch (func) {
        case AggregateFunctions.Count:
            // Count function does not require a column
            return expression;
        case AggregateFunctions.Percentile:
            // Percentile requires a column and a parameter
            if (column && expression.parameters?.length) {
            return expression;
            }
            break;
        default:
            // All the other functions require a column
            if (column) {
            return expression;
            }
        }
    }

    return undefined;
}

export interface QueryEditorPropertyDefinition {
    value: string;
    type: QueryEditorPropertyType;
    label?: string;
    dynamic?: boolean;
  }
  

export const columnsToDefinition = (columns: AzureLogAnalyticsMetadataColumn[]): QueryEditorPropertyDefinition[] => {
    if (!Array.isArray(columns)) {
        return [];
    }

    return columns.map((column) => {
        return {
        value: column.name,
        label: column.name.replace(new RegExp(escapeRegExp(DYNAMIC_TYPE_ARRAY_DELIMITER), 'g'), '[ ]'),
        type: toPropertyType(column.type),
        };
    });
};

export const toPropertyType = (kustoType: string): QueryEditorPropertyType => {
    switch (kustoType) {
        case 'real':
        case 'int':
        case 'long':
        case 'double':
        case 'decimal':
        return QueryEditorPropertyType.Number;
        case 'datetime':
        return QueryEditorPropertyType.DateTime;
        case 'bool':
        return QueryEditorPropertyType.Boolean;
        case 'timespan':
        return QueryEditorPropertyType.TimeSpan;
        default:
        return QueryEditorPropertyType.String;
    }
};

export const formatKQLQuery = (query: string): string => {
    return query.replace(/\s*\|\s*/g, '\n| ').trim();
};



  
