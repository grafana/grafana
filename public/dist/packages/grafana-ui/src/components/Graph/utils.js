import { formattedValueToString, getFieldDisplayName, dateTimeFormat, systemDateFormats, } from '@grafana/data';
/**
 * Returns index of the closest datapoint BEFORE hover position
 *
 * @param posX
 * @param series
 */
export var findHoverIndexFromData = function (xAxisDimension, xPos) {
    var lower = 0;
    var upper = xAxisDimension.values.length - 1;
    var middle;
    while (true) {
        if (lower > upper) {
            return Math.max(upper, 0);
        }
        middle = Math.floor((lower + upper) / 2);
        var xPosition = xAxisDimension.values.get(middle);
        if (xPosition === xPos) {
            return middle;
        }
        else if (xPosition && xPosition < xPos) {
            lower = middle + 1;
        }
        else {
            upper = middle - 1;
        }
    }
};
/**
 * Returns information about closest datapoints when hovering over a Graph
 *
 * @param seriesList list of series visible on the Graph
 * @param pos mouse cursor position, based on jQuery.flot position
 */
export var getMultiSeriesGraphHoverInfo = function (
// x and y axis dimensions order is aligned
yAxisDimensions, xAxisDimensions, 
/** Well, time basically */
xAxisPosition, timeZone) {
    var i, field, hoverIndex, hoverDistance, pointTime;
    var results = [];
    var minDistance, minTime;
    for (i = 0; i < yAxisDimensions.length; i++) {
        field = yAxisDimensions[i];
        var time = xAxisDimensions[i];
        hoverIndex = findHoverIndexFromData(time, xAxisPosition);
        hoverDistance = xAxisPosition - time.values.get(hoverIndex);
        pointTime = time.values.get(hoverIndex);
        // Take the closest point before the cursor, or if it does not exist, the closest after
        if (minDistance === undefined ||
            (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
            (hoverDistance < 0 && hoverDistance > minDistance)) {
            minDistance = hoverDistance;
            minTime = time.display ? formattedValueToString(time.display(pointTime)) : pointTime;
        }
        var disp = field.display(field.values.get(hoverIndex));
        results.push({
            value: formattedValueToString(disp),
            datapointIndex: hoverIndex,
            seriesIndex: i,
            color: disp.color,
            label: getFieldDisplayName(field),
            time: time.display ? formattedValueToString(time.display(pointTime)) : pointTime,
        });
    }
    return {
        results: results,
        time: minTime,
    };
};
export var graphTickFormatter = function (epoch, axis) {
    var _a, _b;
    return dateTimeFormat(epoch, {
        format: (_a = axis === null || axis === void 0 ? void 0 : axis.options) === null || _a === void 0 ? void 0 : _a.timeformat,
        timeZone: (_b = axis === null || axis === void 0 ? void 0 : axis.options) === null || _b === void 0 ? void 0 : _b.timezone,
    });
};
export var graphTimeFormat = function (ticks, min, max) {
    if (min && max && ticks) {
        var range = max - min;
        var secPerTick = range / ticks / 1000;
        // Need have 10 millisecond margin on the day range
        // As sometimes last 24 hour dashboard evaluates to more than 86400000
        var oneDay = 86400010;
        var oneYear = 31536000000;
        if (secPerTick <= 45) {
            return systemDateFormats.interval.second;
        }
        if (range <= oneDay) {
            return systemDateFormats.interval.minute;
        }
        if (secPerTick <= 80000) {
            return systemDateFormats.interval.hour;
        }
        if (range <= oneYear) {
            return systemDateFormats.interval.day;
        }
        if (secPerTick <= 31536000) {
            return systemDateFormats.interval.month;
        }
        return systemDateFormats.interval.year;
    }
    return systemDateFormats.interval.minute;
};
//# sourceMappingURL=utils.js.map