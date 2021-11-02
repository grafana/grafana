import { compare } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import { flow, get, isArray, isEmpty, last, sortBy, tail, toNumber, isNaN } from 'lodash';
export var jsonDiff = function (lhs, rhs) {
    var diffs = compare(lhs, rhs);
    var lhsMap = jsonMap.stringify(lhs, null, 2);
    var rhsMap = jsonMap.stringify(rhs, null, 2);
    var getDiffInformation = function (diffs) {
        return diffs.map(function (diff) {
            var originalValue = undefined;
            var value = undefined;
            var startLineNumber = 0;
            var path = tail(diff.path.split('/'));
            if (diff.op === 'replace') {
                originalValue = get(lhs, path);
                value = diff.value;
                startLineNumber = rhsMap.pointers[diff.path].value.line;
            }
            if (diff.op === 'add') {
                value = diff.value;
                startLineNumber = rhsMap.pointers[diff.path].value.line;
            }
            if (diff.op === 'remove') {
                originalValue = get(lhs, path);
                startLineNumber = lhsMap.pointers[diff.path].value.line;
            }
            return {
                op: diff.op,
                value: value,
                path: path,
                originalValue: originalValue,
                startLineNumber: startLineNumber,
            };
        });
    };
    var sortByLineNumber = function (diffs) { return sortBy(diffs, 'startLineNumber'); };
    var groupByPath = function (diffs) {
        return diffs.reduce(function (acc, value) {
            var groupKey = value.path[0];
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(value);
            return acc;
        }, {});
    };
    return flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};
export var getDiffText = function (diff, showProp) {
    if (showProp === void 0) { showProp = true; }
    var prop = last(diff.path);
    var propIsNumeric = isNumeric(prop);
    var val = diff.op === 'remove' ? diff.originalValue : diff.value;
    var text = getDiffOperationText(diff.op);
    if (showProp) {
        if (propIsNumeric) {
            text += " item " + prop;
        }
        else {
            if (isArray(val) && !isEmpty(val)) {
                text += " " + val.length + " " + prop;
            }
            else {
                text += " " + prop;
            }
        }
    }
    return text;
};
var isNumeric = function (value) { return !isNaN(toNumber(value)); };
export var getDiffOperationText = function (operation) {
    if (operation === 'add') {
        return 'added';
    }
    if (operation === 'remove') {
        return 'deleted';
    }
    return 'changed';
};
//# sourceMappingURL=utils.js.map