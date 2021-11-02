import { __read, __spreadArray } from "tslib";
/** @internal */
export function moveItemImmutably(arr, from, to) {
    var clone = __spreadArray([], __read(arr), false);
    Array.prototype.splice.call(clone, to, 0, Array.prototype.splice.call(clone, from, 1)[0]);
    return clone;
}
//# sourceMappingURL=arrayUtils.js.map