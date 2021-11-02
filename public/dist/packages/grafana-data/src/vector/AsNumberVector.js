import { __extends } from "tslib";
import { FunctionalVector } from './FunctionalVector';
/**
 * This will force all values to be numbers
 *
 * @public
 */
var AsNumberVector = /** @class */ (function (_super) {
    __extends(AsNumberVector, _super);
    function AsNumberVector(field) {
        var _this = _super.call(this) || this;
        _this.field = field;
        return _this;
    }
    Object.defineProperty(AsNumberVector.prototype, "length", {
        get: function () {
            return this.field.length;
        },
        enumerable: false,
        configurable: true
    });
    AsNumberVector.prototype.get = function (index) {
        return +this.field.get(index);
    };
    return AsNumberVector;
}(FunctionalVector));
export { AsNumberVector };
//# sourceMappingURL=AsNumberVector.js.map