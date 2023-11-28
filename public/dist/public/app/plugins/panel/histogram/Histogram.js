import React from 'react';
import uPlot from 'uplot';
import { formattedValueToString, getFieldColorModeForField, getFieldSeriesColor, } from '@grafana/data';
import { histogramBucketSizes, histogramFrameBucketMaxFieldName, } from '@grafana/data/src/transformations/transformers/histogram';
import { ScaleDistribution, AxisPlacement, ScaleDirection, ScaleOrientation } from '@grafana/schema';
import { UPlotConfigBuilder, UPlotChart, VizLayout, PlotLegend, measureText, UPLOT_AXIS_FONT_SIZE, } from '@grafana/ui';
import { defaultFieldConfig } from './panelcfg.gen';
function incrRoundDn(num, incr) {
    return Math.floor(num / incr) * incr;
}
function incrRoundUp(num, incr) {
    return Math.ceil(num / incr) * incr;
}
export function getBucketSize(frame) {
    // assumes BucketMin is fields[0] and BucktMax is fields[1]
    return frame.fields[1].values[0] - frame.fields[0].values[0];
}
const prepConfig = (frame, theme) => {
    // todo: scan all values in BucketMin and BucketMax fields to assert if uniform bucketSize
    var _a, _b;
    // since this is x axis range, this should ideally come from xMin or xMax fields, not a count field
    // though both methods are probably hacks, and we should just accept explicit opts into this prepConfig
    let { min: xScaleMin, max: xScaleMax } = frame.fields[2].config;
    let builder = new UPlotConfigBuilder();
    // assumes BucketMin is fields[0] and BucktMax is fields[1]
    let bucketSize = getBucketSize(frame);
    // splits shifter, to ensure splits always start at first bucket
    let xSplits = (u, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
        /** @ts-ignore */
        let minSpace = u.axes[axisIdx]._space;
        let bucketWidth = u.valToPos(u.data[0][0] + bucketSize, 'x') - u.valToPos(u.data[0][0], 'x');
        let firstSplit = incrRoundDn(xScaleMin !== null && xScaleMin !== void 0 ? xScaleMin : u.data[0][0], bucketSize);
        let lastSplit = incrRoundUp(xScaleMax !== null && xScaleMax !== void 0 ? xScaleMax : u.data[0][u.data[0].length - 1] + bucketSize, bucketSize);
        let splits = [];
        let skip = Math.ceil(minSpace / bucketWidth);
        for (let i = 0, s = firstSplit; s <= lastSplit; i++, s += bucketSize) {
            !(i % skip) && splits.push(s);
        }
        return splits;
    };
    builder.addScale({
        scaleKey: 'x',
        isTime: false,
        distribution: ScaleDistribution.Linear,
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        range: (u, wantedMin, wantedMax) => {
            // these settings will prevent zooming, probably okay?
            if (xScaleMin != null) {
                wantedMin = xScaleMin;
            }
            if (xScaleMax != null) {
                wantedMax = xScaleMax;
            }
            let fullRangeMin = u.data[0][0];
            let fullRangeMax = u.data[0][u.data[0].length - 1];
            // snap to bucket divisors...
            if (wantedMax === fullRangeMax) {
                wantedMax += bucketSize;
            }
            else {
                wantedMax = incrRoundUp(wantedMax, bucketSize);
            }
            if (wantedMin > fullRangeMin) {
                wantedMin = incrRoundDn(wantedMin, bucketSize);
            }
            return [wantedMin, wantedMax];
        },
    });
    builder.addScale({
        scaleKey: 'y',
        isTime: false,
        distribution: ScaleDistribution.Linear,
        orientation: ScaleOrientation.Vertical,
        direction: ScaleDirection.Up,
    });
    const fmt = frame.fields[0].display;
    const xAxisFormatter = (v) => {
        return formattedValueToString(fmt(v));
    };
    builder.addAxis({
        scaleKey: 'x',
        isTime: false,
        placement: AxisPlacement.Bottom,
        incrs: histogramBucketSizes,
        splits: xSplits,
        values: (u, splits) => {
            const tickLabels = splits.map(xAxisFormatter);
            const maxWidth = tickLabels.reduce((curMax, label) => Math.max(measureText(label, UPLOT_AXIS_FONT_SIZE).width, curMax), 0);
            const labelSpacing = 10;
            const maxCount = u.bbox.width / ((maxWidth + labelSpacing) * devicePixelRatio);
            const keepMod = Math.ceil(tickLabels.length / maxCount);
            return tickLabels.map((label, i) => (i % keepMod === 0 ? label : null));
        },
        //incrs: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mult) => mult * bucketSize),
        //splits: config.xSplits,
        //values: config.xValues,
        //grid: false,
        //ticks: false,
        //gap: 15,
        theme,
    });
    // assumes BucketMax is [1]
    let countField = frame.fields[2];
    let dispY = countField.display;
    builder.addAxis({
        scaleKey: 'y',
        isTime: false,
        placement: AxisPlacement.Left,
        formatValue: (v, decimals) => formattedValueToString(dispY(v, decimals)),
        //splits: config.xSplits,
        //values: config.xValues,
        //grid: false,
        //ticks: false,
        //gap: 15,
        theme,
    });
    builder.setCursor({
        points: { show: false },
        drag: {
            x: true,
            y: false,
            setScale: true,
        },
    });
    let pathBuilder = uPlot.paths.bars({ align: 1, size: [1, Infinity] });
    let seriesIndex = 0;
    // assumes xMin is [0], xMax is [1]
    for (let i = 2; i < frame.fields.length; i++) {
        const field = frame.fields[i];
        field.state = (_a = field.state) !== null && _a !== void 0 ? _a : {};
        field.state.seriesIndex = seriesIndex++;
        const customConfig = Object.assign(Object.assign({}, defaultFieldConfig), field.config.custom);
        const scaleKey = 'y';
        const colorMode = getFieldColorModeForField(field);
        const scaleColor = getFieldSeriesColor(field, theme);
        const seriesColor = scaleColor.color;
        builder.addSeries({
            scaleKey,
            lineWidth: customConfig.lineWidth,
            lineColor: seriesColor,
            //lineStyle: customConfig.lineStyle,
            fillOpacity: customConfig.fillOpacity,
            theme,
            colorMode,
            pathBuilder,
            //pointsBuilder: config.drawPoints,
            show: !((_b = customConfig.hideFrom) === null || _b === void 0 ? void 0 : _b.viz),
            gradientMode: customConfig.gradientMode,
            thresholds: field.config.thresholds,
            hardMin: field.config.min,
            hardMax: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            dataFrameFieldIndex: field.state.origin,
        });
    }
    return builder;
};
const preparePlotData = (frame) => {
    let data = [];
    for (const field of frame.fields) {
        if (field.name !== histogramFrameBucketMaxFieldName) {
            data.push(field.values);
        }
    }
    // uPlot's bars pathBuilder will draw rects even if 0 (to distinguish them from nulls)
    // but for histograms we want to omit them, so remap 0s -> nulls
    for (let i = 1; i < data.length; i++) {
        let counts = data[i];
        for (let j = 0; j < counts.length; j++) {
            if (counts[j] === 0) {
                counts[j] = null;
            }
        }
    }
    return data;
};
export class Histogram extends React.Component {
    constructor(props) {
        super(props);
        this.state = this.prepState(props);
    }
    prepState(props, withConfig = true) {
        let state = null;
        const { alignedFrame } = props;
        if (alignedFrame) {
            state = {
                alignedData: preparePlotData(alignedFrame),
            };
            if (withConfig) {
                state.config = prepConfig(alignedFrame, this.props.theme);
            }
        }
        return state;
    }
    renderLegend(config) {
        const { legend } = this.props;
        if (!config || legend.showLegend === false) {
            return null;
        }
        return React.createElement(PlotLegend, Object.assign({ data: this.props.rawSeries, config: config, maxHeight: "35%", maxWidth: "60%" }, legend));
    }
    componentDidUpdate(prevProps) {
        const { structureRev, alignedFrame, bucketSize } = this.props;
        if (alignedFrame !== prevProps.alignedFrame) {
            let newState = this.prepState(this.props, false);
            if (newState) {
                const shouldReconfig = bucketSize !== prevProps.bucketSize ||
                    this.props.options !== prevProps.options ||
                    this.state.config === undefined ||
                    structureRev !== prevProps.structureRev ||
                    !structureRev;
                if (shouldReconfig) {
                    newState.config = prepConfig(alignedFrame, this.props.theme);
                }
            }
            newState && this.setState(newState);
        }
    }
    render() {
        const { width, height, children, alignedFrame } = this.props;
        const { config } = this.state;
        if (!config) {
            return null;
        }
        return (React.createElement(VizLayout, { width: width, height: height, legend: this.renderLegend(config) }, (vizWidth, vizHeight) => (React.createElement(UPlotChart, { config: this.state.config, data: this.state.alignedData, width: vizWidth, height: vizHeight }, children ? children(config, alignedFrame) : null))));
    }
}
//# sourceMappingURL=Histogram.js.map