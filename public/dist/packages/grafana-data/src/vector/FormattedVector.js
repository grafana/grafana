import { __extends } from "tslib";
import { formattedValueToString } from '../valueFormats';
import { FunctionalVector } from './FunctionalVector';
/**
 * @public
 */
var FormattedVector = /** @class */ (function (_super) {
    __extends(FormattedVector, _super);
    function FormattedVector(source, formatter) {
        var _this = _super.call(this) || this;
        _this.source = source;
        _this.formatter = formatter;
        return _this;
    }
    Object.defineProperty(FormattedVector.prototype, "length", {
        get: function () {
            return this.source.length;
        },
        enumerable: false,
        configurable: true
    });
    FormattedVector.prototype.get = function (index) {
        var v = this.source.get(index);
        return formattedValueToString(this.formatter(v));
    };
    return FormattedVector;
}(FunctionalVector));
export { FormattedVector };
//# sourceMappingURL=FormattedVector.js.map