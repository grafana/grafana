import { FieldType } from '@grafana/data';
import { isHistogramFrameBucketMinFieldName, isHistogramFrameBucketMaxFieldName, } from '@grafana/data/src/transformations/transformers/histogram';
export function originalDataHasHistogram(frames) {
    if ((frames === null || frames === void 0 ? void 0 : frames.length) !== 1) {
        return false;
    }
    const frame = frames[0];
    if (frame.fields.length < 3) {
        return false;
    }
    if (!isHistogramFrameBucketMinFieldName(frame.fields[0].name) ||
        !isHistogramFrameBucketMaxFieldName(frame.fields[1].name)) {
        return false;
    }
    for (const field of frame.fields) {
        if (field.type !== FieldType.number) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=utils.js.map