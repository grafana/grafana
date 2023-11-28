import { map } from 'rxjs';
import { DataTransformerID, FieldType, incrRoundUp, incrRoundDn, DataFrameType, getFieldDisplayName, getValueFormat, formattedValueToString, durationToMilliseconds, parseDuration, TransformationApplicabilityLevels, } from '@grafana/data';
import { isLikelyAscendingVector } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { config } from '@grafana/runtime';
import { ScaleDistribution, HeatmapCellLayout, HeatmapCalculationMode, } from '@grafana/schema';
import { niceLinearIncrs, niceTimeIncrs } from './utils';
export const heatmapTransformer = {
    id: DataTransformerID.heatmap,
    name: 'Create heatmap',
    description: 'Generate heatmap data from source data.',
    defaultOptions: {},
    isApplicable: (data) => {
        const { xField, yField, xs, ys } = findHeatmapFields(data);
        if (xField || yField) {
            return TransformationApplicabilityLevels.NotPossible;
        }
        if (!xs.length || !ys.length) {
            return TransformationApplicabilityLevels.NotPossible;
        }
        return TransformationApplicabilityLevels.Applicable;
    },
    isApplicableDescription: 'The Heatmap transformation requires fields with Heatmap compatible data. No fields with Heatmap data could be found.',
    operator: (options, ctx) => (source) => source.pipe(map((data) => {
        var _a, _b, _c, _d;
        if (config.featureToggles.transformationsVariableSupport) {
            const optionsCopy = Object.assign(Object.assign({}, options), { xBuckets: (_a = Object.assign({}, options.xBuckets)) !== null && _a !== void 0 ? _a : undefined, yBuckets: (_b = Object.assign({}, options.yBuckets)) !== null && _b !== void 0 ? _b : undefined });
            if ((_c = optionsCopy.xBuckets) === null || _c === void 0 ? void 0 : _c.value) {
                optionsCopy.xBuckets.value = ctx.interpolate(optionsCopy.xBuckets.value);
            }
            if ((_d = optionsCopy.yBuckets) === null || _d === void 0 ? void 0 : _d.value) {
                optionsCopy.yBuckets.value = ctx.interpolate(optionsCopy.yBuckets.value);
            }
            return heatmapTransformer.transformer(optionsCopy, ctx)(data);
        }
        else {
            return heatmapTransformer.transformer(options, ctx)(data);
        }
    })),
    transformer: (options) => {
        return (data) => {
            const v = calculateHeatmapFromData(data, options);
            if (options.keepOriginalData) {
                return [v, ...data];
            }
            return [v];
        };
    },
};
function parseNumeric(v) {
    return v === '+Inf' ? Infinity : v === '-Inf' ? -Infinity : +(v !== null && v !== void 0 ? v : 0);
}
export function sortAscStrInf(aName, bName) {
    return parseNumeric(aName) - parseNumeric(bName);
}
/** simple utility to get heatmap metadata from a frame */
export function readHeatmapRowsCustomMeta(frame) {
    var _a, _b;
    return ((_b = (_a = frame === null || frame === void 0 ? void 0 : frame.meta) === null || _a === void 0 ? void 0 : _a.custom) !== null && _b !== void 0 ? _b : {});
}
export function isHeatmapCellsDense(frame) {
    let foundY = false;
    for (let field of frame.fields) {
        // dense heatmap frames can only have one of these fields
        switch (field.name) {
            case 'y':
            case 'yMin':
            case 'yMax':
                if (foundY) {
                    return false;
                }
                foundY = true;
        }
    }
    return foundY;
}
/** Given existing buckets, create a values style frame */
// Assumes frames have already been sorted ASC and de-accumulated.
export function rowsToCellsHeatmap(opts) {
    var _a, _b, _c, _d, _e;
    // TODO: handle null-filling w/ fields[0].config.interval?
    const xField = opts.frame.fields[0];
    const xValues = xField.values;
    const yFields = opts.frame.fields.filter((f, idx) => f.type === FieldType.number && idx > 0);
    // similar to initBins() below
    const len = xValues.length * yFields.length;
    const xs = new Array(len);
    const ys = new Array(len);
    const counts2 = new Array(len);
    const counts = yFields.map((field) => field.values.slice());
    // transpose
    counts.forEach((bucketCounts, bi) => {
        for (let i = 0; i < bucketCounts.length; i++) {
            counts2[counts.length * i + bi] = bucketCounts[i];
        }
    });
    const bucketBounds = Array.from({ length: yFields.length }, (v, i) => i);
    // fill flat/repeating array
    for (let i = 0, yi = 0, xi = 0; i < len; yi = ++i % bucketBounds.length) {
        ys[i] = bucketBounds[yi];
        if (yi === 0 && i >= bucketBounds.length) {
            xi++;
        }
        xs[i] = xValues[xi];
    }
    // this name determines whether cells are drawn above, below, or centered on the values
    let ordinalFieldName = ((_a = yFields[0].labels) === null || _a === void 0 ? void 0 : _a.le) != null ? 'yMax' : 'y';
    switch (opts.layout) {
        case HeatmapCellLayout.le:
            ordinalFieldName = 'yMax';
            break;
        case HeatmapCellLayout.ge:
            ordinalFieldName = 'yMin';
            break;
        case HeatmapCellLayout.unknown:
            ordinalFieldName = 'y';
            break;
    }
    const custom = {
        yOrdinalDisplay: yFields.map((f) => getFieldDisplayName(f, opts.frame)),
        yMatchWithLabel: Object.keys((_b = yFields[0].labels) !== null && _b !== void 0 ? _b : {})[0],
    };
    if (custom.yMatchWithLabel) {
        custom.yOrdinalLabel = yFields.map((f) => { var _a, _b; return (_b = (_a = f.labels) === null || _a === void 0 ? void 0 : _a[custom.yMatchWithLabel]) !== null && _b !== void 0 ? _b : ''; });
        if (custom.yMatchWithLabel === 'le') {
            custom.yMinDisplay = '0.0';
        }
    }
    // Format the labels as a value
    // TODO: this leaves the internally prepended '0.0' without this formatting treatment
    if (((_c = opts.unit) === null || _c === void 0 ? void 0 : _c.length) || opts.decimals != null) {
        const fmt = getValueFormat((_d = opts.unit) !== null && _d !== void 0 ? _d : 'short');
        if (custom.yMinDisplay) {
            custom.yMinDisplay = formattedValueToString(fmt(0, opts.decimals));
        }
        custom.yOrdinalDisplay = custom.yOrdinalDisplay.map((name) => {
            let num = +name;
            if (!Number.isNaN(num)) {
                return formattedValueToString(fmt(num, opts.decimals));
            }
            return name;
        });
    }
    const valueCfg = Object.assign({}, yFields[0].config);
    if (valueCfg.displayNameFromDS) {
        delete valueCfg.displayNameFromDS;
    }
    return {
        length: xs.length,
        refId: opts.frame.refId,
        meta: {
            type: DataFrameType.HeatmapCells,
            custom,
        },
        fields: [
            {
                name: xField.type === FieldType.time ? 'xMax' : 'x',
                type: xField.type,
                values: xs,
                config: xField.config,
            },
            {
                name: ordinalFieldName,
                type: FieldType.number,
                values: ys,
                config: {
                    unit: 'short', // ordinal lookup
                },
            },
            {
                name: ((_e = opts.value) === null || _e === void 0 ? void 0 : _e.length) ? opts.value : 'Value',
                type: FieldType.number,
                values: counts2,
                config: valueCfg,
                display: yFields[0].display,
            },
        ],
    };
}
// Sorts frames ASC by numeric bucket name and de-accumulates values in each frame's Value field [1]
// similar to Prometheus result_transformer.ts -> transformToHistogramOverTime()
export function prepBucketFrames(frames) {
    frames = frames.slice();
    // sort ASC by frame.name (Prometheus bucket bound)
    // or use frame.fields[1].config.displayNameFromDS ?
    frames.sort((a, b) => sortAscStrInf(a.name, b.name));
    // cumulative counts
    const counts = frames.map((frame) => frame.fields[1].values.slice());
    // de-accumulate
    counts.reverse();
    counts.forEach((bucketCounts, bi) => {
        if (bi < counts.length - 1) {
            for (let i = 0; i < bucketCounts.length; i++) {
                bucketCounts[i] -= counts[bi + 1][i];
            }
        }
    });
    counts.reverse();
    return frames.map((frame, i) => (Object.assign(Object.assign({}, frame), { fields: [
            frame.fields[0],
            Object.assign(Object.assign({}, frame.fields[1]), { values: counts[i] }),
        ] })));
}
export function calculateHeatmapFromData(frames, options) {
    var _a, _b, _c, _d, _e, _f;
    // Find fields in the heatmap
    const { xField, yField, xs, ys } = findHeatmapFields(frames);
    if (!xField || !yField) {
        throw 'no heatmap fields found';
    }
    if (!xs.length || !ys.length) {
        throw 'no values found';
    }
    const xBucketsCfg = (_a = options.xBuckets) !== null && _a !== void 0 ? _a : {};
    const yBucketsCfg = (_b = options.yBuckets) !== null && _b !== void 0 ? _b : {};
    if (((_c = xBucketsCfg.scale) === null || _c === void 0 ? void 0 : _c.type) === ScaleDistribution.Log) {
        throw 'X axis only supports linear buckets';
    }
    const scaleDistribution = (_e = (_d = options.yBuckets) === null || _d === void 0 ? void 0 : _d.scale) !== null && _e !== void 0 ? _e : {
        type: ScaleDistribution.Linear,
    };
    const heat2d = heatmap(xs, ys, {
        xSorted: isLikelyAscendingVector(xs),
        xTime: xField.type === FieldType.time,
        xMode: xBucketsCfg.mode,
        xSize: xBucketsCfg.mode === HeatmapCalculationMode.Size
            ? durationToMilliseconds(parseDuration((_f = xBucketsCfg.value) !== null && _f !== void 0 ? _f : ''))
            : xBucketsCfg.value
                ? +xBucketsCfg.value
                : undefined,
        yMode: yBucketsCfg.mode,
        ySize: yBucketsCfg.value ? +yBucketsCfg.value : undefined,
        yLog: (scaleDistribution === null || scaleDistribution === void 0 ? void 0 : scaleDistribution.type) === ScaleDistribution.Log ? scaleDistribution === null || scaleDistribution === void 0 ? void 0 : scaleDistribution.log : undefined,
    });
    const frame = {
        length: heat2d.x.length,
        name: getFieldDisplayName(yField),
        meta: {
            type: DataFrameType.HeatmapCells,
        },
        fields: [
            {
                name: 'xMin',
                type: xField.type,
                values: heat2d.x,
                config: xField.config,
            },
            {
                name: 'yMin',
                type: FieldType.number,
                values: heat2d.y,
                config: Object.assign(Object.assign({}, yField.config), { custom: {
                        scaleDistribution,
                    } }),
            },
            {
                name: 'Count',
                type: FieldType.number,
                values: heat2d.count,
                config: {
                    unit: 'short', // always integer
                },
            },
        ],
    };
    return frame;
}
/**
 * Find fields that can be used within a heatmap
 *
 * @param frames
 *  An array of DataFrames
 */
function findHeatmapFields(frames) {
    let xField = undefined;
    let yField = undefined;
    let dataLen = 0;
    // pre-allocate arrays
    for (let frame of frames) {
        // TODO: assumes numeric timestamps, ordered asc, without nulls
        const x = frame.fields.find((f) => f.type === FieldType.time);
        if (x) {
            dataLen += frame.length;
        }
    }
    let xs = Array(dataLen);
    let ys = Array(dataLen);
    let j = 0;
    for (let frame of frames) {
        // TODO: assumes numeric timestamps, ordered asc, without nulls
        const x = frame.fields.find((f) => f.type === FieldType.time);
        if (!x) {
            continue;
        }
        if (!xField) {
            xField = x; // the first X
        }
        const xValues = x.values;
        for (let field of frame.fields) {
            if (field !== x && field.type === FieldType.number) {
                const yValues = field.values;
                for (let i = 0; i < xValues.length; i++, j++) {
                    xs[j] = xValues[i];
                    ys[j] = yValues[i];
                }
                if (!yField) {
                    yField = field;
                }
            }
        }
    }
    return { xField, yField, xs, ys };
}
// TODO: handle NaN, Inf, -Inf, null, undefined values in xs & ys
function heatmap(xs, ys, opts) {
    var _a, _b, _c, _d, _e;
    let len = xs.length;
    let xSorted = (_a = opts === null || opts === void 0 ? void 0 : opts.xSorted) !== null && _a !== void 0 ? _a : false;
    let ySorted = (_b = opts === null || opts === void 0 ? void 0 : opts.ySorted) !== null && _b !== void 0 ? _b : false;
    // find x and y limits to pre-compute buckets struct
    let minX = xSorted ? xs[0] : Infinity;
    let minY = ySorted ? ys[0] : Infinity;
    let maxX = xSorted ? xs[len - 1] : -Infinity;
    let maxY = ySorted ? ys[len - 1] : -Infinity;
    let yExp = opts === null || opts === void 0 ? void 0 : opts.yLog;
    for (let i = 0; i < len; i++) {
        if (!xSorted) {
            minX = Math.min(minX, xs[i]);
            maxX = Math.max(maxX, xs[i]);
        }
        if (!ySorted) {
            if (!yExp || ys[i] > 0) {
                minY = Math.min(minY, ys[i]);
                maxY = Math.max(maxY, ys[i]);
            }
        }
    }
    //let scaleX = opts?.xLog === 10 ? Math.log10 : opts?.xLog === 2 ? Math.log2 : (v: number) => v;
    //let scaleY = opts?.yLog === 10 ? Math.log10 : opts?.yLog === 2 ? Math.log2 : (v: number) => v;
    let xBinIncr = (_c = opts === null || opts === void 0 ? void 0 : opts.xSize) !== null && _c !== void 0 ? _c : 0;
    let yBinIncr = (_d = opts === null || opts === void 0 ? void 0 : opts.ySize) !== null && _d !== void 0 ? _d : 0;
    let xMode = opts === null || opts === void 0 ? void 0 : opts.xMode;
    let yMode = opts === null || opts === void 0 ? void 0 : opts.yMode;
    // fall back to 10 buckets if invalid settings
    if (!Number.isFinite(xBinIncr) || xBinIncr <= 0) {
        xMode = HeatmapCalculationMode.Count;
        xBinIncr = 20;
    }
    if (!Number.isFinite(yBinIncr) || yBinIncr <= 0) {
        yMode = HeatmapCalculationMode.Count;
        yBinIncr = 10;
    }
    if (xMode === HeatmapCalculationMode.Count) {
        // TODO: optionally use view range min/max instead of data range for bucket sizing
        let approx = (maxX - minX) / Math.max(xBinIncr - 1, 1);
        // nice-ify
        let xIncrs = (opts === null || opts === void 0 ? void 0 : opts.xTime) ? niceTimeIncrs : niceLinearIncrs;
        let xIncrIdx = xIncrs.findIndex((bucketSize) => bucketSize > approx) - 1;
        xBinIncr = xIncrs[Math.max(xIncrIdx, 0)];
    }
    if (yMode === HeatmapCalculationMode.Count) {
        // TODO: optionally use view range min/max instead of data range for bucket sizing
        let approx = (maxY - minY) / Math.max(yBinIncr - 1, 1);
        // nice-ify
        let yIncrs = (opts === null || opts === void 0 ? void 0 : opts.yTime) ? niceTimeIncrs : niceLinearIncrs;
        let yIncrIdx = yIncrs.findIndex((bucketSize) => bucketSize > approx) - 1;
        yBinIncr = yIncrs[Math.max(yIncrIdx, 0)];
    }
    // console.log({
    //   yBinIncr,
    //   xBinIncr,
    // });
    let binX = (opts === null || opts === void 0 ? void 0 : opts.xCeil) ? (v) => incrRoundUp(v, xBinIncr) : (v) => incrRoundDn(v, xBinIncr);
    let binY = (opts === null || opts === void 0 ? void 0 : opts.yCeil) ? (v) => incrRoundUp(v, yBinIncr) : (v) => incrRoundDn(v, yBinIncr);
    if (yExp) {
        yBinIncr = 1 / ((_e = opts === null || opts === void 0 ? void 0 : opts.ySize) !== null && _e !== void 0 ? _e : 1); // sub-divides log exponents
        let yLog = yExp === 2 ? Math.log2 : Math.log10;
        binY = (opts === null || opts === void 0 ? void 0 : opts.yCeil) ? (v) => incrRoundUp(yLog(v), yBinIncr) : (v) => incrRoundDn(yLog(v), yBinIncr);
    }
    let minXBin = binX(minX);
    let maxXBin = binX(maxX);
    let minYBin = binY(minY);
    let maxYBin = binY(maxY);
    let xBinQty = Math.round((maxXBin - minXBin) / xBinIncr) + 1;
    let yBinQty = Math.round((maxYBin - minYBin) / yBinIncr) + 1;
    let [xs2, ys2, counts] = initBins(xBinQty, yBinQty, minXBin, xBinIncr, minYBin, yBinIncr, yExp);
    for (let i = 0; i < len; i++) {
        if (yExp && ys[i] <= 0) {
            continue;
        }
        const xi = (binX(xs[i]) - minXBin) / xBinIncr;
        const yi = (binY(ys[i]) - minYBin) / yBinIncr;
        const ci = xi * yBinQty + yi;
        counts[ci]++;
    }
    return {
        x: xs2,
        y: ys2,
        count: counts,
    };
}
function initBins(xQty, yQty, xMin, xIncr, yMin, yIncr, yExp) {
    const len = xQty * yQty;
    const xs = new Array(len);
    const ys = new Array(len);
    const counts = new Array(len);
    for (let i = 0, yi = 0, x = xMin; i < len; yi = ++i % yQty) {
        counts[i] = 0;
        if (yExp) {
            ys[i] = Math.pow(yExp, (yMin + yi * yIncr));
        }
        else {
            ys[i] = yMin + yi * yIncr;
        }
        if (yi === 0 && i >= yQty) {
            x += xIncr;
        }
        xs[i] = x;
    }
    return [xs, ys, counts];
}
//# sourceMappingURL=heatmap.js.map