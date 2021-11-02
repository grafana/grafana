import React, { useMemo } from 'react';
import { buildHistogram, getHistogramFields } from '@grafana/data';
import { Histogram, getBucketSize } from './Histogram';
import { useTheme2 } from '@grafana/ui';
import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';
export var HistogramPanel = function (_a) {
    var data = _a.data, options = _a.options, width = _a.width, height = _a.height;
    var theme = useTheme2();
    var histogram = useMemo(function () {
        var _a;
        if (!((_a = data === null || data === void 0 ? void 0 : data.series) === null || _a === void 0 ? void 0 : _a.length)) {
            return undefined;
        }
        if (data.series.length === 1) {
            var info = getHistogramFields(data.series[0]);
            if (info) {
                return histogramFieldsToFrame(info);
            }
        }
        var hist = buildHistogram(data.series, options);
        if (!hist) {
            return undefined;
        }
        return histogramFieldsToFrame(hist, theme);
    }, [data.series, options, theme]);
    if (!histogram || !histogram.fields.length) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No histogram found in response")));
    }
    var bucketSize = getBucketSize(histogram);
    return (React.createElement(Histogram, { options: options, theme: theme, legend: options.legend, structureRev: data.structureRev, width: width, height: height, alignedFrame: histogram, bucketSize: bucketSize }, function (config, alignedFrame) {
        return null; // <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
    }));
};
//# sourceMappingURL=HistogramPanel.js.map