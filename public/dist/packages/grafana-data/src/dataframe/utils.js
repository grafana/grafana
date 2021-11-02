import { FieldType } from '../types/dataFrame';
import { getTimeField } from './processDataFrame';
export function isTimeSerie(frame) {
    if (frame.fields.length > 2) {
        return false;
    }
    return Boolean(frame.fields.find(function (field) { return field.type === FieldType.time; }));
}
export function isTimeSeries(data) {
    return !data.find(function (frame) { return !isTimeSerie(frame); });
}
/**
 * Indicates if there is any time field in the array of data frames
 * @param data
 */
export function anySeriesWithTimeField(data) {
    for (var i = 0; i < data.length; i++) {
        var timeField = getTimeField(data[i]);
        if (timeField.timeField !== undefined && timeField.timeIndex !== undefined) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=utils.js.map