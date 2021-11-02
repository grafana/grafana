import { __assign, __rest, __values } from "tslib";
import { FieldType } from '../types';
import { ArrayVector } from '../vector';
import { guessFieldTypeFromNameAndValue } from './processDataFrame';
var ENTITY_MAP = {
    Inf: Infinity,
    NegInf: -Infinity,
    Undef: undefined,
    NaN: NaN,
};
/**
 * @internal use locally
 */
export function decodeFieldValueEntities(lookup, values) {
    var e_1, _a;
    if (!lookup || !values) {
        return;
    }
    for (var key in lookup) {
        var repl = ENTITY_MAP[key];
        try {
            for (var _b = (e_1 = void 0, __values(lookup[key])), _c = _b.next(); !_c.done; _c = _b.next()) {
                var idx = _c.value;
                if (idx < values.length) {
                    values[idx] = repl;
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
    }
}
function guessFieldType(name, values) {
    var e_2, _a;
    try {
        for (var values_1 = __values(values), values_1_1 = values_1.next(); !values_1_1.done; values_1_1 = values_1.next()) {
            var v = values_1_1.value;
            if (v != null) {
                return guessFieldTypeFromNameAndValue(name, v);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (values_1_1 && !values_1_1.done && (_a = values_1.return)) _a.call(values_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return FieldType.other;
}
/**
 * NOTE: dto.data.values will be mutated and decoded/inflated using entities,bases,factors,enums
 *
 * @alpha
 */
export function dataFrameFromJSON(dto) {
    var schema = dto.schema, data = dto.data;
    if (!schema || !schema.fields) {
        throw new Error('JSON needs a fields definition');
    }
    // Find the longest field length
    var length = data ? data.values.reduce(function (max, vals) { return Math.max(max, vals.length); }, 0) : 0;
    var fields = schema.fields.map(function (f, index) {
        var _a, _b;
        var buffer = data ? data.values[index] : [];
        var origLen = buffer.length;
        if (origLen !== length) {
            buffer.length = length;
            // avoid sparse arrays
            buffer.fill(undefined, origLen);
        }
        var entities;
        if ((entities = data && data.entities && data.entities[index])) {
            decodeFieldValueEntities(entities, buffer);
        }
        // TODO: expand arrays further using bases,factors,enums
        return __assign(__assign({}, f), { type: (_a = f.type) !== null && _a !== void 0 ? _a : guessFieldType(f.name, buffer), config: (_b = f.config) !== null && _b !== void 0 ? _b : {}, values: new ArrayVector(buffer), 
            // the presence of this prop is an optimization signal & lookup for consumers
            entities: entities !== null && entities !== void 0 ? entities : {} });
    });
    return __assign(__assign({}, schema), { fields: fields, length: length });
}
/**
 * This converts DataFrame to a json representation with distinct schema+data
 *
 * @alpha
 */
export function dataFrameToJSON(frame) {
    var data = {
        values: [],
    };
    var schema = {
        refId: frame.refId,
        meta: frame.meta,
        name: frame.name,
        fields: frame.fields.map(function (f) {
            var values = f.values, sfield = __rest(f, ["values"]);
            data.values.push(values.toArray());
            return sfield;
        }),
    };
    return {
        schema: schema,
        data: data,
    };
}
//# sourceMappingURL=DataFrameJSON.js.map