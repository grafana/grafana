import { rangeUtil, dateTimeFormat } from '@grafana/data';
export var mapOptionToTimeRange = function (option, timeZone) {
    return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};
export var mapRangeToTimeOption = function (range, timeZone) {
    var from = dateTimeFormat(range.from, { timeZone: timeZone });
    var to = dateTimeFormat(range.to, { timeZone: timeZone });
    return {
        from: from,
        to: to,
        display: from + " to " + to,
    };
};
//# sourceMappingURL=mapper.js.map