import { vectorToArray } from './vectorToArray';
/**
 * @public
 */
var BinaryOperationVector = /** @class */ (function () {
    function BinaryOperationVector(left, right, operation) {
        this.left = left;
        this.right = right;
        this.operation = operation;
    }
    Object.defineProperty(BinaryOperationVector.prototype, "length", {
        get: function () {
            return this.left.length;
        },
        enumerable: false,
        configurable: true
    });
    BinaryOperationVector.prototype.get = function (index) {
        return this.operation(this.left.get(index), this.right.get(index));
    };
    BinaryOperationVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    BinaryOperationVector.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return BinaryOperationVector;
}());
export { BinaryOperationVector };
//# sourceMappingURL=BinaryOperationVector.js.map