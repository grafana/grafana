/**
 * Performs a shallow comparison of two sets with the same item type.
 */
export function equal(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    var it = a.values();
    while (true) {
        var _a = it.next(), value = _a.value, done = _a.done;
        if (done) {
            return true;
        }
        if (!b.has(value)) {
            return false;
        }
    }
}
/**
 * Returns a new set with items in both sets using shallow comparison.
 */
export function intersect(a, b) {
    var result = new Set();
    var it = b.values();
    while (true) {
        var _a = it.next(), value = _a.value, done = _a.done;
        if (done) {
            return result;
        }
        if (a.has(value)) {
            result.add(value);
        }
    }
}
//# sourceMappingURL=set.js.map