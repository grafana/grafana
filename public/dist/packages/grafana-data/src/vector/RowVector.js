import { vectorToArray } from './vectorToArray';
/**
 * RowVector makes the row values look like a vector
 * @internal
 */
var RowVector = /** @class */ (function () {
    function RowVector(columns) {
        this.columns = columns;
        this.rowIndex = 0;
    }
    Object.defineProperty(RowVector.prototype, "length", {
        get: function () {
            return this.columns.length;
        },
        enumerable: false,
        configurable: true
    });
    RowVector.prototype.get = function (index) {
        return this.columns[index].get(this.rowIndex);
    };
    RowVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    RowVector.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return RowVector;
}());
export { RowVector };
//# sourceMappingURL=RowVector.js.map