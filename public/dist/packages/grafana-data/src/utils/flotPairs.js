import { NullValueMode } from '../types/data';
export function getFlotPairs(_a) {
    var xField = _a.xField, yField = _a.yField, nullValueMode = _a.nullValueMode;
    var vX = xField.values;
    var vY = yField.values;
    var length = vX.length;
    if (vY.length !== length) {
        throw new Error('Unexpected field length');
    }
    var ignoreNulls = nullValueMode === NullValueMode.Ignore;
    var nullAsZero = nullValueMode === NullValueMode.AsZero;
    var pairs = [];
    for (var i = 0; i < length; i++) {
        var x = vX.get(i);
        var y = vY.get(i);
        if (y === null) {
            if (ignoreNulls) {
                continue;
            }
            if (nullAsZero) {
                y = 0;
            }
        }
        // X must be a value
        if (x === null) {
            continue;
        }
        pairs.push([x, y]);
    }
    return pairs;
}
/**
 * Returns a constant series based on the first value from the provide series.
 * @param seriesData Series
 * @param range Start and end time for the constant series
 */
export function getFlotPairsConstant(seriesData, range) {
    if (!range.from || !range.to || !seriesData || seriesData.length === 0) {
        return [];
    }
    var from = range.from.valueOf();
    var to = range.to.valueOf();
    var value = seriesData[0][1];
    return [
        [from, value],
        [to, value],
    ];
}
//# sourceMappingURL=flotPairs.js.map