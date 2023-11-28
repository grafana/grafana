import { property } from 'lodash';
let fieldAccessorCache = {};
export function getFieldAccessor(fieldPath) {
    const accessor = fieldAccessorCache[fieldPath];
    if (accessor) {
        return accessor;
    }
    return (fieldAccessorCache[fieldPath] = property(fieldPath));
}
//# sourceMappingURL=fieldAccessorCache.js.map