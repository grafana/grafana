import { toUtc } from '@grafana/data';
export var getShiftedTimeRange = function (direction, origRange) {
    var range = {
        from: toUtc(origRange.from),
        to: toUtc(origRange.to),
    };
    var timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
    var to, from;
    if (direction === -1) {
        to = range.to.valueOf() - timespan;
        from = range.from.valueOf() - timespan;
    }
    else if (direction === 1) {
        to = range.to.valueOf() + timespan;
        from = range.from.valueOf() + timespan;
        if (to > Date.now() && range.to.valueOf() < Date.now()) {
            to = Date.now();
            from = range.from.valueOf();
        }
    }
    else {
        to = range.to.valueOf();
        from = range.from.valueOf();
    }
    return { from: from, to: to };
};
export var getZoomedTimeRange = function (range, factor) {
    var timespan = range.to.valueOf() - range.from.valueOf();
    var center = range.to.valueOf() - timespan / 2;
    var to = center + (timespan * factor) / 2;
    var from = center - (timespan * factor) / 2;
    return { from: from, to: to };
};
//# sourceMappingURL=timePicker.js.map