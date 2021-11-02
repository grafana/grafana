import { __values } from "tslib";
import { vectorToArray } from './vectorToArray';
/**
 * This may be more trouble than it is worth.  This trades some computation time for
 * RAM -- rather than allocate a new array the size of all previous arrays, this just
 * points the correct index to their original array values
 */
var AppendedVectors = /** @class */ (function () {
    function AppendedVectors(startAt) {
        if (startAt === void 0) { startAt = 0; }
        this.length = 0;
        this.source = [];
        this.length = startAt;
    }
    /**
     * Make the vector look like it is this long
     */
    AppendedVectors.prototype.setLength = function (length) {
        var e_1, _a;
        if (length > this.length) {
            // make the vector longer (filling with undefined)
            this.length = length;
        }
        else if (length < this.length) {
            // make the array shorter
            var sources = [];
            try {
                for (var _b = __values(this.source), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var src = _c.value;
                    sources.push(src);
                    if (src.end > length) {
                        src.end = length;
                        break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            this.source = sources;
            this.length = length;
        }
    };
    AppendedVectors.prototype.append = function (v) {
        var info = {
            start: this.length,
            end: this.length + v.length,
            values: v,
        };
        this.length = info.end;
        this.source.push(info);
        return info;
    };
    AppendedVectors.prototype.get = function (index) {
        for (var i = 0; i < this.source.length; i++) {
            var src = this.source[i];
            if (index >= src.start && index < src.end) {
                return src.values.get(index - src.start);
            }
        }
        return undefined;
    };
    AppendedVectors.prototype.toArray = function () {
        return vectorToArray(this);
    };
    AppendedVectors.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return AppendedVectors;
}());
export { AppendedVectors };
//# sourceMappingURL=AppendedVectors.js.map