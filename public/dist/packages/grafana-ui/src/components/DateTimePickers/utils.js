import { dateMath, dateTimeParse, isDateTime } from '@grafana/data';
export function isValid(value, roundUp, timeZone) {
    if (isDateTime(value)) {
        return value.isValid();
    }
    if (dateMath.isMathString(value)) {
        return dateMath.isValid(value);
    }
    var parsed = dateTimeParse(value, { roundUp: roundUp, timeZone: timeZone });
    return parsed.isValid();
}
//# sourceMappingURL=utils.js.map