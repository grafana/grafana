import { __values } from "tslib";
import { FieldType } from '@grafana/data';
import { histogramFrameBucketMinFieldName, histogramFrameBucketMaxFieldName, } from '@grafana/data/src/transformations/transformers/histogram';
export function originalDataHasHistogram(frames) {
    var e_1, _a;
    if ((frames === null || frames === void 0 ? void 0 : frames.length) !== 1) {
        return false;
    }
    var frame = frames[0];
    if (frame.fields.length < 3) {
        return false;
    }
    if (frame.fields[0].name !== histogramFrameBucketMinFieldName ||
        frame.fields[1].name !== histogramFrameBucketMaxFieldName) {
        return false;
    }
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (field.type !== FieldType.number) {
                return false;
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
    return true;
}
//# sourceMappingURL=utils.js.map