import { __assign, __extends, __values } from "tslib";
import { FieldType } from '../types/dataFrame';
import { guessFieldTypeFromValue, guessFieldTypeForField, toDataFrameDTO } from './processDataFrame';
import { isString } from 'lodash';
import { makeFieldParser } from '../utils/fieldParser';
import { ArrayVector } from '../vector/ArrayVector';
import { FunctionalVector } from '../vector/FunctionalVector';
export var MISSING_VALUE = undefined; // Treated as connected in new graph panel
var MutableDataFrame = /** @class */ (function (_super) {
    __extends(MutableDataFrame, _super);
    function MutableDataFrame(source, creator) {
        var e_1, _a;
        var _this = _super.call(this) || this;
        _this.fields = [];
        _this.first = new ArrayVector();
        // This creates the underlying storage buffers
        _this.creator = creator
            ? creator
            : function (buffer) {
                return new ArrayVector(buffer);
            };
        // Copy values from
        if (source) {
            var name_1 = source.name, refId = source.refId, meta = source.meta, fields = source.fields;
            if (name_1) {
                _this.name = name_1;
            }
            if (refId) {
                _this.refId = refId;
            }
            if (meta) {
                _this.meta = meta;
            }
            if (fields) {
                try {
                    for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                        var f = fields_1_1.value;
                        _this.addField(f);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
        }
        // Get Length to show up if you use spread
        Object.defineProperty(_this, 'length', {
            enumerable: true,
            get: function () {
                return _this.first.length;
            },
        });
        return _this;
    }
    Object.defineProperty(MutableDataFrame.prototype, "length", {
        // Defined for Vector interface
        get: function () {
            return this.first.length;
        },
        enumerable: false,
        configurable: true
    });
    MutableDataFrame.prototype.addFieldFor = function (value, name) {
        return this.addField({
            name: name || '',
            type: guessFieldTypeFromValue(value),
        });
    };
    MutableDataFrame.prototype.addField = function (f, startLength) {
        var buffer = undefined;
        if (f.values) {
            if (Array.isArray(f.values)) {
                buffer = f.values;
            }
            else {
                buffer = f.values.toArray();
            }
        }
        var type = f.type;
        if (!type && ('time' === f.name || 'Time' === f.name)) {
            type = FieldType.time;
        }
        else {
            if (!type && buffer && buffer.length) {
                type = guessFieldTypeFromValue(buffer[0]);
            }
            if (!type) {
                type = FieldType.other;
            }
        }
        // Make sure it has a name
        var name = f.name;
        if (!name) {
            name = "Field " + (this.fields.length + 1);
        }
        var field = __assign(__assign({}, f), { name: name, type: type, config: f.config || {}, values: this.creator(buffer) });
        if (type === FieldType.other) {
            type = guessFieldTypeForField(field);
            if (type) {
                field.type = type;
            }
        }
        this.fields.push(field);
        this.first = this.fields[0].values;
        // Make sure the field starts with a given length
        if (startLength) {
            while (field.values.length < startLength) {
                field.values.add(MISSING_VALUE);
            }
        }
        else {
            this.validate();
        }
        return field;
    };
    MutableDataFrame.prototype.validate = function () {
        var e_2, _a;
        // Make sure all arrays are the same length
        var length = this.fields.reduce(function (v, f) {
            return Math.max(v, f.values.length);
        }, 0);
        try {
            // Add empty elements until everything matches
            for (var _b = __values(this.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                while (field.values.length !== length) {
                    field.values.add(MISSING_VALUE);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    /**
     * Reverse all values
     */
    MutableDataFrame.prototype.reverse = function () {
        var e_3, _a;
        try {
            for (var _b = __values(this.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var f = _c.value;
                f.values.reverse();
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    /**
     * This will add each value to the corresponding column
     */
    MutableDataFrame.prototype.appendRow = function (row) {
        // Add any extra columns
        for (var i = this.fields.length; i < row.length; i++) {
            this.addField({
                name: "Field " + (i + 1),
                type: guessFieldTypeFromValue(row[i]),
            });
        }
        // The first line may change the field types
        if (this.length < 1) {
            for (var i = 0; i < this.fields.length; i++) {
                var f = this.fields[i];
                if (!f.type || f.type === FieldType.other) {
                    f.type = guessFieldTypeFromValue(row[i]);
                }
            }
        }
        for (var i = 0; i < this.fields.length; i++) {
            var f = this.fields[i];
            var v = row[i];
            if (f.type !== FieldType.string && isString(v)) {
                if (!f.parse) {
                    f.parse = makeFieldParser(v, f);
                }
                v = f.parse(v);
            }
            f.values.add(v);
        }
    };
    /**
     * Add values from an object to corresponding fields. Similar to appendRow but does not create new fields.
     */
    MutableDataFrame.prototype.add = function (value) {
        var e_4, _a;
        // Will add one value for every field
        var obj = value;
        try {
            for (var _b = __values(this.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                var val = obj[field.name];
                if (field.type !== FieldType.string && isString(val)) {
                    if (!field.parse) {
                        field.parse = makeFieldParser(val, field);
                    }
                    val = field.parse(val);
                }
                if (val === undefined) {
                    val = MISSING_VALUE;
                }
                field.values.add(val);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
    };
    MutableDataFrame.prototype.set = function (index, value) {
        var e_5, _a;
        if (index > this.length) {
            throw new Error('Unable ot set value beyond current length');
        }
        var obj = value || {};
        try {
            for (var _b = __values(this.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                field.values.set(index, obj[field.name]);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
    };
    /**
     * Get an object with a property for each field in the DataFrame
     */
    MutableDataFrame.prototype.get = function (idx) {
        var e_6, _a;
        var v = {};
        try {
            for (var _b = __values(this.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                v[field.name] = field.values.get(idx);
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_6) throw e_6.error; }
        }
        return v;
    };
    /**
     * The simplified JSON values used in JSON.stringify()
     */
    MutableDataFrame.prototype.toJSON = function () {
        return toDataFrameDTO(this);
    };
    return MutableDataFrame;
}(FunctionalVector));
export { MutableDataFrame };
//# sourceMappingURL=MutableDataFrame.js.map