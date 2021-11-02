import { __generator, __values } from "tslib";
import { vectorToArray } from './vectorToArray';
/** @public */
var FunctionalVector = /** @class */ (function () {
    function FunctionalVector() {
    }
    // Implement "iterator protocol"
    FunctionalVector.prototype.iterator = function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < this.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, this.get(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    };
    // Implement "iterable protocol"
    FunctionalVector.prototype[Symbol.iterator] = function () {
        return this.iterator();
    };
    FunctionalVector.prototype.forEach = function (iterator) {
        return vectorator(this).forEach(iterator);
    };
    FunctionalVector.prototype.map = function (transform) {
        return vectorator(this).map(transform);
    };
    FunctionalVector.prototype.filter = function (predicate) {
        return vectorator(this).filter(predicate);
    };
    FunctionalVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    FunctionalVector.prototype.toJSON = function () {
        return this.toArray();
    };
    return FunctionalVector;
}());
export { FunctionalVector };
/**
 * Use functional programming with your vector
 */
export function vectorator(vector) {
    var _a;
    return _a = {},
        _a[Symbol.iterator] = function () {
            var i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < vector.length)) return [3 /*break*/, 4];
                        return [4 /*yield*/, vector.get(i)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        },
        _a.forEach = function (iterator) {
            for (var i = 0; i < vector.length; i++) {
                iterator(vector.get(i));
            }
        },
        _a.map = function (transform) {
            var result = [];
            for (var i = 0; i < vector.length; i++) {
                result.push(transform(vector.get(i), i));
            }
            return result;
        },
        /** Add a predicate where you return true if it should *keep* the value */
        _a.filter = function (predicate) {
            var e_1, _a;
            var result = [];
            try {
                for (var _b = __values(this), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var val = _c.value;
                    if (predicate(val)) {
                        result.push(val);
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
            return result;
        },
        _a;
}
//# sourceMappingURL=FunctionalVector.js.map