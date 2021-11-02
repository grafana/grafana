import { histogram } from 'd3';
/**
 * Convert series into array of series values.
 * @param data Array of series
 */
export function getSeriesValues(dataList) {
    var VALUE_INDEX = 0;
    var values = [];
    // Count histogam stats
    for (var i = 0; i < dataList.length; i++) {
        var series = dataList[i];
        var datapoints = series.datapoints;
        for (var j = 0; j < datapoints.length; j++) {
            if (datapoints[j][VALUE_INDEX] !== null) {
                values.push(datapoints[j][VALUE_INDEX]);
            }
        }
    }
    return values;
}
/**
 * Convert array of values into timeseries-like histogram:
 * [[val_1, count_1], [val_2, count_2], ..., [val_n, count_n]]
 * @param values
 * @param bucketSize
 */
export function convertValuesToHistogram(values, bucketSize, min, max) {
    var minBound = getBucketBound(min, bucketSize);
    var maxBound = getBucketBound(max, bucketSize);
    var histGenerator = histogram()
        .domain([minBound, maxBound])
        .thresholds(Math.round(max - min) / bucketSize);
    return histGenerator(values).map(function (bin) {
        return [bin.x0, bin.length];
    });
}
/**
 * Convert series into array of histogram data.
 * @param data Array of series
 * @param bucketSize
 */
export function convertToHistogramData(data, bucketSize, hiddenSeries, min, max) {
    return data.map(function (series) {
        var values = getSeriesValues([series]);
        series.histogram = true;
        if (!hiddenSeries[series.alias]) {
            var histogram_1 = convertValuesToHistogram(values, bucketSize, min, max);
            series.data = histogram_1;
        }
        else {
            series.data = [];
        }
        return series;
    });
}
function getBucketBound(value, bucketSize) {
    return Math.floor(value / bucketSize) * bucketSize;
}
//# sourceMappingURL=histogram.js.map