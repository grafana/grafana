import { __assign, __read, __spreadArray } from "tslib";
import { FieldType, guessFieldTypeForField } from '../index';
var FieldCache = /** @class */ (function () {
    function FieldCache(data) {
        this.fields = [];
        this.fieldByName = {};
        this.fieldByType = {};
        this.fields = data.fields.map(function (field, idx) { return (__assign(__assign({}, field), { index: idx })); });
        for (var i = 0; i < data.fields.length; i++) {
            var field = data.fields[i];
            // Make sure it has a type
            if (field.type === FieldType.other) {
                var t = guessFieldTypeForField(field);
                if (t) {
                    field.type = t;
                }
            }
            if (!this.fieldByType[field.type]) {
                this.fieldByType[field.type] = [];
            }
            this.fieldByType[field.type].push(__assign(__assign({}, field), { index: i }));
            if (this.fieldByName[field.name]) {
                console.warn('Duplicate field names in DataFrame: ', field.name);
            }
            else {
                this.fieldByName[field.name] = __assign(__assign({}, field), { index: i });
            }
        }
    }
    FieldCache.prototype.getFields = function (type) {
        if (!type) {
            return __spreadArray([], __read(this.fields), false); // All fields
        }
        var fields = this.fieldByType[type];
        if (fields) {
            return __spreadArray([], __read(fields), false);
        }
        return [];
    };
    FieldCache.prototype.hasFieldOfType = function (type) {
        var types = this.fieldByType[type];
        return types && types.length > 0;
    };
    FieldCache.prototype.getFirstFieldOfType = function (type, includeHidden) {
        if (includeHidden === void 0) { includeHidden = false; }
        var fields = this.fieldByType[type];
        var firstField = fields.find(function (field) { var _a; return includeHidden || !((_a = field.config.custom) === null || _a === void 0 ? void 0 : _a.hidden); });
        return firstField;
    };
    FieldCache.prototype.hasFieldNamed = function (name) {
        return !!this.fieldByName[name];
    };
    FieldCache.prototype.hasFieldWithNameAndType = function (name, type) {
        return !!this.fieldByName[name] && this.fieldByType[type].filter(function (field) { return field.name === name; }).length > 0;
    };
    /**
     * Returns the first field with the given name.
     */
    FieldCache.prototype.getFieldByName = function (name) {
        return this.fieldByName[name];
    };
    /**
     * Returns the fields with the given label.
     */
    FieldCache.prototype.getFieldsByLabel = function (label, value) {
        return Object.values(this.fieldByName).filter(function (f) {
            return f.labels && f.labels[label] === value;
        });
    };
    return FieldCache;
}());
export { FieldCache };
//# sourceMappingURL=FieldCache.js.map