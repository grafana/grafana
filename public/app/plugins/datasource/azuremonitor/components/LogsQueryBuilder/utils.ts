import { escapeRegExp } from "lodash";

import { SelectableValue } from "@grafana/data";

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
