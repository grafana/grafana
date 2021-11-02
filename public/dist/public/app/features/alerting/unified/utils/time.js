import { __read } from "tslib";
import { describeInterval } from '@grafana/data/src/datetime/rangeutil';
import { TimeOptions } from '../types/time';
export function parseInterval(value) {
    var match = value.match(/(\d+)(\w+)/);
    if (match) {
        return [Number(match[1]), match[2]];
    }
    throw new Error("Invalid interval description: " + value);
}
export function intervalToSeconds(interval) {
    var _a = describeInterval(interval), sec = _a.sec, count = _a.count;
    return sec * count;
}
export var timeOptions = Object.entries(TimeOptions).map(function (_a) {
    var _b = __read(_a, 2), key = _b[0], value = _b[1];
    return ({
        label: key[0].toUpperCase() + key.slice(1),
        value: value,
    });
});
// 1h, 10m and such
export var positiveDurationValidationPattern = {
    value: new RegExp("^\\d+(" + Object.values(TimeOptions).join('|') + ")$"),
    message: "Must be of format \"(number)(unit)\" , for example \"1m\". Available units: " + Object.values(TimeOptions).join(', '),
};
// 1h, 10m or 0 (without units)
export var durationValidationPattern = {
    value: new RegExp("^\\d+(" + Object.values(TimeOptions).join('|') + ")|0$"),
    message: "Must be of format \"(number)(unit)\", for example \"1m\", or just \"0\". Available units: " + Object.values(TimeOptions).join(', '),
};
//# sourceMappingURL=time.js.map