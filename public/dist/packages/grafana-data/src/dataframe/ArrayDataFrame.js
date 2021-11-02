import { __extends } from "tslib";
import { vectorToArray } from '../vector/vectorToArray';
import { guessFieldTypeFromNameAndValue, toDataFrameDTO } from './processDataFrame';
import { FunctionalVector } from '../vector/FunctionalVector';
var NOOP = function (v) { return v; };
var ArrayPropertyVector = /** @class */ (function () {
    function ArrayPropertyVector(source, prop) {
        this.source = source;
        this.prop = prop;
        this.converter = NOOP;
    }
    Object.defineProperty(ArrayPropertyVector.prototype, "length", {
        get: function () {
            return this.source.length;
        },
        enumerable: false,
        configurable: true
    });
    ArrayPropertyVector.prototype.get = function (index) {
        return this.converter(this.source[index][this.prop]);
    };
    ArrayPropertyVector.prototype.toArray = function () {
        return vectorToArray(this);
    };
    ArrayPropertyVector.prototype.toJSON = function () {
        return vectorToArray(this);
    };
    return ArrayPropertyVector;
}());
/**
 * The ArrayDataFrame takes an array of objects and presents it as a DataFrame
 *
 * @alpha
 */
var ArrayDataFrame = /** @class */ (function (_super) {
    __extends(ArrayDataFrame, _super);
    function ArrayDataFrame(source, names) {
        var _this = _super.call(this) || this;
        _this.source = source;
        _this.fields = [];
        _this.length = 0;
        _this.length = source.length;
        var first = source.length ? source[0] : {};
        if (names) {
            _this.fields = names.map(function (name) {
                return {
                    name: name,
                    type: guessFieldTypeFromNameAndValue(name, first[name]),
                    config: {},
                    values: new ArrayPropertyVector(source, name),
                };
            });
        }
        else {
            _this.setFieldsFromObject(first);
        }
        return _this;
    }
    /**
     * Add a field for each property in the object.  This will guess the type
     */
    ArrayDataFrame.prototype.setFieldsFromObject = function (obj) {
        var _this = this;
        this.fields = Object.keys(obj).map(function (name) {
            return {
                name: name,
                type: guessFieldTypeFromNameAndValue(name, obj[name]),
                config: {},
                values: new ArrayPropertyVector(_this.source, name),
            };
        });
    };
    /**
     * Configure how the object property is passed to the data frame
     */
    ArrayDataFrame.prototype.setFieldType = function (name, type, converter) {
        var field = this.fields.find(function (f) { return f.name === name; });
        if (field) {
            field.type = type;
        }
        else {
            field = {
                name: name,
                type: type,
                config: {},
                values: new ArrayPropertyVector(this.source, name),
            };
            this.fields.push(field);
        }
        field.values.converter = converter !== null && converter !== void 0 ? converter : NOOP;
        return field;
    };
    /**
     * Get an object with a property for each field in the DataFrame
     */
    ArrayDataFrame.prototype.get = function (idx) {
        return this.source[idx];
    };
    /**
     * The simplified JSON values used in JSON.stringify()
     */
    ArrayDataFrame.prototype.toJSON = function () {
        return toDataFrameDTO(this);
    };
    return ArrayDataFrame;
}(FunctionalVector));
export { ArrayDataFrame };
//# sourceMappingURL=ArrayDataFrame.js.map