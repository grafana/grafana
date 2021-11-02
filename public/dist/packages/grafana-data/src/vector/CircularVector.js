import { __extends } from "tslib";
import { vectorToArray } from './vectorToArray';
import { FunctionalVector } from './FunctionalVector';
/**
 * Circular vector uses a single buffer to capture a stream of values
 * overwriting the oldest value on add.
 *
 * This supports adding to the 'head' or 'tail' and will grow the buffer
 * to match a configured capacity.
 *
 * @public
 */
var CircularVector = /** @class */ (function (_super) {
    __extends(CircularVector, _super);
    function CircularVector(options) {
        var _this = _super.call(this) || this;
        _this.buffer = options.buffer || [];
        _this.capacity = _this.buffer.length;
        _this.tail = 'head' !== options.append;
        _this.index = 0;
        _this.add = _this.getAddFunction();
        if (options.capacity) {
            _this.setCapacity(options.capacity);
        }
        return _this;
    }
    /**
     * This gets the appropriate add function depending on the buffer state:
     *  * head vs tail
     *  * growing buffer vs overwriting values
     */
    CircularVector.prototype.getAddFunction = function () {
        var _this = this;
        // When we are not at capacity, it should actually modify the buffer
        if (this.capacity > this.buffer.length) {
            if (this.tail) {
                return function (value) {
                    _this.buffer.push(value);
                    if (_this.buffer.length >= _this.capacity) {
                        _this.add = _this.getAddFunction();
                    }
                };
            }
            else {
                return function (value) {
                    _this.buffer.unshift(value);
                    if (_this.buffer.length >= _this.capacity) {
                        _this.add = _this.getAddFunction();
                    }
                };
            }
        }
        if (this.tail) {
            return function (value) {
                _this.buffer[_this.index] = value;
                _this.index = (_this.index + 1) % _this.buffer.length;
            };
        }
        // Append values to the head
        return function (value) {
            var idx = _this.index - 1;
            if (idx < 0) {
                idx = _this.buffer.length - 1;
            }
            _this.buffer[idx] = value;
            _this.index = idx;
        };
    };
    CircularVector.prototype.setCapacity = function (v) {
        if (this.capacity === v) {
            return;
        }
        // Make a copy so it is in order and new additions can be at the head or tail
        var copy = this.toArray();
        if (v > this.length) {
            this.buffer = copy;
        }
        else if (v < this.capacity) {
            // Shrink the buffer
            var delta = this.length - v;
            if (this.tail) {
                this.buffer = copy.slice(delta, copy.length); // Keep last items
            }
            else {
                this.buffer = copy.slice(0, copy.length - delta); // Keep first items
            }
        }
        this.capacity = v;
        this.index = 0;
        this.add = this.getAddFunction();
    };
    CircularVector.prototype.setAppendMode = function (mode) {
        var tail = 'head' !== mode;
        if (tail !== this.tail) {
            this.buffer = this.toArray().reverse();
            this.index = 0;
            this.tail = tail;
            this.add = this.getAddFunction();
        }
    };
    CircularVector.prototype.reverse = function () {
        this.buffer.reverse();
    };
    CircularVector.prototype.get = function (index) {
        return this.buffer[(index + this.index) % this.buffer.length];
    };
    CircularVector.prototype.set = function (index, value) {
        this.buffer[(index + this.index) % this.buffer.length] = value;
    };
    Object.defineProperty(CircularVector.prototype, "length", {
        get: function () {
            return this.buffer.length;
        },
        enumerable: false,
        configurable: true
    });
    CircularVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    CircularVector.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return CircularVector;
}(FunctionalVector));
export { CircularVector };
//# sourceMappingURL=CircularVector.js.map