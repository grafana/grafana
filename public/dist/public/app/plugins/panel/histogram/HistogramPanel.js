import React, { useMemo } from 'react';
import { buildHistogram, getHistogramFields } from '@grafana/data';
import { histogramFieldsToFrame } from '@grafana/data/src/transformations/transformers/histogram';
import { useTheme2 } from '@grafana/ui';
import { Histogram, getBucketSize } from './Histogram';
export const HistogramPanel = ({ data, options, width, height }) => {
    const theme = useTheme2();
    const histogram = useMemo(() => {
        if (!data.series.length) {
            return undefined;
        }
        // stamp origins for legend's calcs (from raw values)
        data.series.forEach((frame, frameIndex) => {
            frame.fields.forEach((field, fieldIndex) => {
                field.state = Object.assign(Object.assign({}, field.state), { origin: {
                        frameIndex,
                        fieldIndex,
                    } });
            });
        });
        if (data.series.length === 1) {
            const info = getHistogramFields(data.series[0]);
            if (info) {
                return histogramFieldsToFrame(info);
            }
        }
        const hist = buildHistogram(data.series, options);
        if (!hist) {
            return undefined;
        }
        return histogramFieldsToFrame(hist, theme);
    }, [data.series, options, theme]);
    if (!histogram || !histogram.fields.length) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, "No histogram found in response")));
    }
    const bucketSize = getBucketSize(histogram);
    return (React.createElement(Histogram, { options: options, theme: theme, legend: options.legend, rawSeries: data.series, structureRev: data.structureRev, width: width, height: height, alignedFrame: histogram, bucketSize: bucketSize }, (config, alignedFrame) => {
        return null; // <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
    }));
};
//# sourceMappingURL=HistogramPanel.js.map