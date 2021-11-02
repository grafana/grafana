import { vectorToArray } from './vectorToArray';
/**
 * Values are returned in the order defined by the input parameter
 */
var SortedVector = /** @class */ (function () {
    function SortedVector(source, order) {
        this.source = source;
        this.order = order;
    }
    Object.defineProperty(SortedVector.prototype, "length", {
        get: function () {
            return this.source.length;
        },
        enumerable: false,
        configurable: true
    });
    SortedVector.prototype.get = function (index) {
        return this.source.get(this.order[index]);
    };
    SortedVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    SortedVector.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return SortedVector;
}());
export { SortedVector };
//# sourceMappingURL=SortedVector.js.map