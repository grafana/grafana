import { isArray, isPlainObject } from 'lodash';
/** @returns a deep clone of the object, but with any null value removed */
export function sortedDeepCloneWithoutNulls(value) {
    if (isArray(value)) {
        return value.map(sortedDeepCloneWithoutNulls);
    }
    if (isPlainObject(value)) {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
            const v = value[key];
            if (v != null) {
                acc[key] = sortedDeepCloneWithoutNulls(v);
            }
            return acc;
        }, {});
    }
    return value;
}
//# sourceMappingURL=object.js.map