import { __values } from "tslib";
import { ReducerID, reduceField, FieldType } from '@grafana/data';
/**
 * Find the min and max time that covers all data
 */
export function getDataTimeRange(frames) {
    var e_1, _a, e_2, _b;
    var range = {
        from: Number.MAX_SAFE_INTEGER,
        to: Number.MIN_SAFE_INTEGER,
    };
    var found = false;
    var reducers = [ReducerID.min, ReducerID.max];
    try {
        for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
            var frame = frames_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    if (field.type === FieldType.time) {
                        var calcs = reduceField({ field: field, reducers: reducers });
                        range.from = Math.min(range.from, calcs[ReducerID.min]);
                        range.to = Math.max(range.to, calcs[ReducerID.max]);
                        found = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (frames_1_1 && !frames_1_1.done && (_a = frames_1.return)) _a.call(frames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return found ? range : undefined;
}
//# sourceMappingURL=utils.js.map