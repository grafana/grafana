import { __extends } from "tslib";
import { FunctionalVector } from './FunctionalVector';
/**
 * @public
 */
var ArrayVector = /** @class */ (function (_super) {
    __extends(ArrayVector, _super);
    function ArrayVector(buffer) {
        var _this = _super.call(this) || this;
        _this.buffer = buffer ? buffer : [];
        return _this;
    }
    Object.defineProperty(ArrayVector.prototype, "length", {
        get: function () {
            return this.buffer.length;
        },
        enumerable: false,
        configurable: true
    });
    ArrayVector.prototype.add = function (value) {
        this.buffer.push(value);
    };
    ArrayVector.prototype.get = function (index) {
        return this.buffer[index];
    };
    ArrayVector.prototype.set = function (index, value) {
        this.buffer[index] = value;
    };
    ArrayVector.prototype.reverse = function () {
        this.buffer.reverse();
    };
    ArrayVector.prototype.toArray = function () {
        return this.buffer;
    };
    ArrayVector.prototype.toJSON = function () {
        return this.buffer;
    };
    return ArrayVector;
}(FunctionalVector));
export { ArrayVector };
//# sourceMappingURL=ArrayVector.js.map