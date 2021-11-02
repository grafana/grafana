import { ArrayVector, FieldType, outerJoinDataFrames } from '@grafana/data';
import { nullToUndefThreshold } from './nullToUndefThreshold';
// will mutate the DataFrame's fields' values
function applySpanNullsThresholds(frame) {
    var _a;
    var refField = frame.fields.find(function (field) { return field.type === FieldType.time; }); // this doesnt need to be time, just any numeric/asc join field
    var refValues = refField === null || refField === void 0 ? void 0 : refField.values.toArray();
    for (var i = 0; i < frame.fields.length; i++) {
        var field = frame.fields[i];
        if (field === refField) {
            continue;
        }
        if (field.type === FieldType.number) {
            var spanNulls = (_a = field.config.custom) === null || _a === void 0 ? void 0 : _a.spanNulls;
            if (typeof spanNulls === 'number') {
                if (spanNulls !== -1) {
                    field.values = new ArrayVector(nullToUndefThreshold(refValues, field.values.toArray(), spanNulls));
                }
            }
        }
    }
    return frame;
}
export function preparePlotFrame(frames, dimFields) {
    var alignedFrame = outerJoinDataFrames({
        frames: frames,
        joinBy: dimFields.x,
        keep: dimFields.y,
        keepOriginIndices: true,
    });
    return alignedFrame && applySpanNullsThresholds(alignedFrame);
}
//# sourceMappingURL=utils.js.map