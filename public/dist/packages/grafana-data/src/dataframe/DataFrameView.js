import { __assign, __extends } from "tslib";
import { FunctionalVector } from '../vector/FunctionalVector';
/**
 * This abstraction will present the contents of a DataFrame as if
 * it were a well typed javascript object Vector.
 *
 * @remarks
 * The {@link DataFrameView.get} is optimized for use in a loop and will return same object.
 * See function for more details.
 *
 * @typeParam T - Type of object stored in the DataFrame.
 * @beta
 */
var DataFrameView = /** @class */ (function (_super) {
    __extends(DataFrameView, _super);
    function DataFrameView(data) {
        var _this = _super.call(this) || this;
        _this.data = data;
        _this.index = 0;
        var obj = {};
        var _loop_1 = function (i) {
            var field = data.fields[i];
            var getter = function () { return field.values.get(_this.index); };
            if (!obj.hasOwnProperty(field.name)) {
                Object.defineProperty(obj, field.name, {
                    enumerable: true,
                    get: getter,
                });
            }
            if (!obj.hasOwnProperty(i.toString())) {
                Object.defineProperty(obj, i, {
                    enumerable: false,
                    get: getter,
                });
            }
        };
        for (var i = 0; i < data.fields.length; i++) {
            _loop_1(i);
        }
        _this.obj = obj;
        return _this;
    }
    Object.defineProperty(DataFrameView.prototype, "dataFrame", {
        get: function () {
            return this.data;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DataFrameView.prototype, "length", {
        get: function () {
            return this.data.length;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Helper function to return the {@link DisplayProcessor} for a given field column.
     * @param colIndex - the field column index for the data frame.
     */
    DataFrameView.prototype.getFieldDisplayProcessor = function (colIndex) {
        if (!this.dataFrame || !this.dataFrame.fields) {
            return undefined;
        }
        var field = this.dataFrame.fields[colIndex];
        if (!field || !field.display) {
            return undefined;
        }
        return field.display;
    };
    /**
     * The contents of the object returned from this function
     * are optimized for use in a loop. All calls return the same object
     * but the index has changed.
     *
     * @example
     * ```typescript
     *   // `first`, `second` and `third` will all point to the same contents at index 2:
     *   const first = view.get(0);
     *   const second = view.get(1);
     *   const third = view.get(2);
     *
     *   // If you need three different objects, consider something like:
     *   const first = { ...view.get(0) };
     *   const second = { ...view.get(1) };
     *   const third = { ...view.get(2) };
     * ```
     * @param idx - The index of the object you currently are inspecting
     */
    DataFrameView.prototype.get = function (idx) {
        this.index = idx;
        return this.obj;
    };
    DataFrameView.prototype.toArray = function () {
        var _this = this;
        return new Array(this.data.length)
            .fill(0) // Needs to make a full copy
            .map(function (_, i) { return (__assign({}, _this.get(i))); });
    };
    return DataFrameView;
}(FunctionalVector));
export { DataFrameView };
//# sourceMappingURL=DataFrameView.js.map