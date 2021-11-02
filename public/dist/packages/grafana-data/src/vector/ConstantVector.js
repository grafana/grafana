/**
 * @public
 */
var ConstantVector = /** @class */ (function () {
    function ConstantVector(value, len) {
        this.value = value;
        this.len = len;
    }
    Object.defineProperty(ConstantVector.prototype, "length", {
        get: function () {
            return this.len;
        },
        enumerable: false,
        configurable: true
    });
    ConstantVector.prototype.get = function (index) {
        return this.value;
    };
    ConstantVector.prototype.toArray = function () {
        var arr = new Array(this.length);
        return arr.fill(this.value);
    };
    ConstantVector.prototype.toJSON = function () {
        return this.toArray();
    };
    return ConstantVector;
}());
export { ConstantVector };
//# sourceMappingURL=ConstantVector.js.map