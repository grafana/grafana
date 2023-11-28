import { compare } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import { flow, get, isArray, isEmpty, last, sortBy, tail, toNumber, isNaN } from 'lodash';
export const jsonDiff = (lhs, rhs) => {
    const diffs = compare(lhs, rhs);
    const lhsMap = jsonMap.stringify(lhs, null, 2);
    const rhsMap = jsonMap.stringify(rhs, null, 2);
    const getDiffInformation = (diffs) => {
        return diffs.map((diff) => {
            let originalValue = undefined;
            let value = undefined;
            let startLineNumber = 0;
            const path = tail(diff.path.split('/'));
            if (diff.op === 'replace' && rhsMap.pointers[diff.path]) {
                originalValue = get(lhs, path);
                value = diff.value;
                startLineNumber = rhsMap.pointers[diff.path].value.line;
            }
            if (diff.op === 'add' && rhsMap.pointers[diff.path]) {
                value = diff.value;
                startLineNumber = rhsMap.pointers[diff.path].value.line;
            }
            if (diff.op === 'remove' && lhsMap.pointers[diff.path]) {
                originalValue = get(lhs, path);
                startLineNumber = lhsMap.pointers[diff.path].value.line;
            }
            return {
                op: diff.op,
                value,
                path,
                originalValue,
                startLineNumber,
            };
        });
    };
    const sortByLineNumber = (diffs) => sortBy(diffs, 'startLineNumber');
    const groupByPath = (diffs) => diffs.reduce((acc, value) => {
        const groupKey = value.path[0];
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(value);
        return acc;
    }, {});
    return flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};
export const getDiffText = (diff, showProp = true) => {
    const prop = last(diff.path);
    const propIsNumeric = isNumeric(prop);
    const val = diff.op === 'remove' ? diff.originalValue : diff.value;
    let text = getDiffOperationText(diff.op);
    if (showProp) {
        if (propIsNumeric) {
            text += ` item ${prop}`;
        }
        else {
            if (isArray(val) && !isEmpty(val)) {
                text += ` ${val.length} ${prop}`;
            }
            else {
                text += ` ${prop}`;
            }
        }
    }
    return text;
};
const isNumeric = (value) => !isNaN(toNumber(value));
export const getDiffOperationText = (operation) => {
    if (operation === 'add') {
        return 'added';
    }
    if (operation === 'remove') {
        return 'deleted';
    }
    return 'changed';
};
//# sourceMappingURL=utils.js.map