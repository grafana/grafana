import { FieldType } from '../types/dataFrame';
import { dateTime } from '../datetime';
import { isNumber } from 'lodash';
/** @public */
export var fieldIndexComparer = function (field, reverse) {
    if (reverse === void 0) { reverse = false; }
    var values = field.values;
    switch (field.type) {
        case FieldType.number:
            return numericIndexComparer(values, reverse);
        case FieldType.string:
            return stringIndexComparer(values, reverse);
        case FieldType.boolean:
            return booleanIndexComparer(values, reverse);
        case FieldType.time:
            return timeIndexComparer(values, reverse);
        default:
            return naturalIndexComparer(reverse);
    }
};
/** @public */
export var timeComparer = function (a, b) {
    if (!a || !b) {
        return falsyComparer(a, b);
    }
    if (isNumber(a) && isNumber(b)) {
        return numericComparer(a, b);
    }
    if (dateTime(a).isBefore(b)) {
        return -1;
    }
    if (dateTime(b).isBefore(a)) {
        return 1;
    }
    return 0;
};
/** @public */
export var numericComparer = function (a, b) {
    return a - b;
};
/** @public */
export var stringComparer = function (a, b) {
    if (!a || !b) {
        return falsyComparer(a, b);
    }
    return a.localeCompare(b);
};
export var booleanComparer = function (a, b) {
    return falsyComparer(a, b);
};
var falsyComparer = function (a, b) {
    if (!a && b) {
        return 1;
    }
    if (a && !b) {
        return -1;
    }
    return 0;
};
var timeIndexComparer = function (values, reverse) {
    return function (a, b) {
        var vA = values.get(a);
        var vB = values.get(b);
        return reverse ? timeComparer(vB, vA) : timeComparer(vA, vB);
    };
};
var booleanIndexComparer = function (values, reverse) {
    return function (a, b) {
        var vA = values.get(a);
        var vB = values.get(b);
        return reverse ? booleanComparer(vB, vA) : booleanComparer(vA, vB);
    };
};
var numericIndexComparer = function (values, reverse) {
    return function (a, b) {
        var vA = values.get(a);
        var vB = values.get(b);
        return reverse ? numericComparer(vB, vA) : numericComparer(vA, vB);
    };
};
var stringIndexComparer = function (values, reverse) {
    return function (a, b) {
        var vA = values.get(a);
        var vB = values.get(b);
        return reverse ? stringComparer(vB, vA) : stringComparer(vA, vB);
    };
};
var naturalIndexComparer = function (reverse) {
    return function (a, b) {
        return reverse ? numericComparer(b, a) : numericComparer(a, b);
    };
};
//# sourceMappingURL=fieldComparers.js.map