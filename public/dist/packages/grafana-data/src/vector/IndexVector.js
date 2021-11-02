import { __extends } from "tslib";
import { FieldType } from '../types';
import { FunctionalVector } from './FunctionalVector';
/**
 * IndexVector is a simple vector implementation that returns the index value
 * for each element in the vector.  It is functionally equivolant a vector backed
 * by an array with values: `[0,1,2,...,length-1]`
 */
var IndexVector = /** @class */ (function (_super) {
    __extends(IndexVector, _super);
    function IndexVector(len) {
        var _this = _super.call(this) || this;
        _this.len = len;
        return _this;
    }
    Object.defineProperty(IndexVector.prototype, "length", {
        get: function () {
            return this.len;
        },
        enumerable: false,
        configurable: true
    });
    IndexVector.prototype.get = function (index) {
        return index;
    };
    /**
     * Returns a field representing the range [0 ... length-1]
     */
    IndexVector.newField = function (len) {
        return {
            name: '',
            values: new IndexVector(len),
            type: FieldType.number,
            config: {
                min: 0,
                max: len - 1,
            },
        };
    };
    return IndexVector;
}(FunctionalVector));
export { IndexVector };
//# sourceMappingURL=IndexVector.js.map