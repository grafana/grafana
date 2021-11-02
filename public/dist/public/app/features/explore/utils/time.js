import { isDateTime } from '@grafana/data';
export var toRawTimeRange = function (range) {
    var from = range.raw.from;
    if (isDateTime(from)) {
        from = from.valueOf().toString(10);
    }
    var to = range.raw.to;
    if (isDateTime(to)) {
        to = to.valueOf().toString(10);
    }
    return {
        from: from,
        to: to,
    };
};
//# sourceMappingURL=time.js.map