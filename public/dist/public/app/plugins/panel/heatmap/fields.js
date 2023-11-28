import { cacheFieldDisplayNames, DataFrameType, FieldType, formattedValueToString, getDisplayProcessor, outerJoinDataFrames, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HeatmapCellLayout } from '@grafana/schema';
import { calculateHeatmapFromData, isHeatmapCellsDense, readHeatmapRowsCustomMeta, rowsToCellsHeatmap, } from 'app/features/transformers/calculateHeatmap/heatmap';
import { parseSampleValue, sortSeriesByLabel } from 'app/plugins/datasource/prometheus/result_transformer';
import { boundedMinMax, valuesToFills } from './utils';
export function prepareHeatmapData(frames, annotations, options, palette, theme, getFieldLinks, replaceVariables) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    if (!(frames === null || frames === void 0 ? void 0 : frames.length)) {
        return {};
    }
    cacheFieldDisplayNames(frames);
    const exemplars = annotations === null || annotations === void 0 ? void 0 : annotations.find((f) => f.name === 'exemplar');
    if (getFieldLinks) {
        exemplars === null || exemplars === void 0 ? void 0 : exemplars.fields.forEach((field, index) => {
            exemplars.fields[index].getLinks = getFieldLinks(exemplars, field);
        });
    }
    if (options.calculate) {
        if (config.featureToggles.transformationsVariableSupport) {
            const optionsCopy = Object.assign(Object.assign({}, options), { calculation: {
                    xBuckets: (_b = Object.assign({}, (_a = options.calculation) === null || _a === void 0 ? void 0 : _a.xBuckets)) !== null && _b !== void 0 ? _b : undefined,
                    yBuckets: (_d = Object.assign({}, (_c = options.calculation) === null || _c === void 0 ? void 0 : _c.yBuckets)) !== null && _d !== void 0 ? _d : undefined,
                } });
            if (((_f = (_e = optionsCopy.calculation) === null || _e === void 0 ? void 0 : _e.xBuckets) === null || _f === void 0 ? void 0 : _f.value) && replaceVariables !== undefined) {
                optionsCopy.calculation.xBuckets.value = replaceVariables(optionsCopy.calculation.xBuckets.value);
            }
            if (((_h = (_g = optionsCopy.calculation) === null || _g === void 0 ? void 0 : _g.yBuckets) === null || _h === void 0 ? void 0 : _h.value) && replaceVariables !== undefined) {
                optionsCopy.calculation.yBuckets.value = replaceVariables(optionsCopy.calculation.yBuckets.value);
            }
            return getDenseHeatmapData(calculateHeatmapFromData(frames, (_j = optionsCopy.calculation) !== null && _j !== void 0 ? _j : {}), exemplars, optionsCopy, palette, theme);
        }
        return getDenseHeatmapData(calculateHeatmapFromData(frames, (_k = options.calculation) !== null && _k !== void 0 ? _k : {}), exemplars, options, palette, theme);
    }
    // Check for known heatmap types
    let rowsHeatmap = undefined;
    for (const frame of frames) {
        switch ((_l = frame.meta) === null || _l === void 0 ? void 0 : _l.type) {
            case DataFrameType.HeatmapCells:
                return isHeatmapCellsDense(frame)
                    ? getDenseHeatmapData(frame, exemplars, options, palette, theme)
                    : getSparseHeatmapData(frame, exemplars, options, palette, theme);
            case DataFrameType.HeatmapRows:
                rowsHeatmap = frame; // the default format
        }
    }
    // Everything past here assumes a field for each row in the heatmap (buckets)
    if (!rowsHeatmap) {
        if (frames.length > 1) {
            let allNamesNumeric = frames.every((frame) => { var _a; return !Number.isNaN(parseSampleValue((_a = frame.fields[1].state) === null || _a === void 0 ? void 0 : _a.displayName)); });
            if (allNamesNumeric) {
                frames.sort(sortSeriesByLabel);
            }
            rowsHeatmap = [
                outerJoinDataFrames({
                    frames,
                }),
            ][0];
        }
        else {
            let frame = frames[0];
            let numberFields = frame.fields.filter((field) => field.type === FieldType.number);
            let allNamesNumeric = numberFields.every((field) => { var _a; return !Number.isNaN(parseSampleValue((_a = field.state) === null || _a === void 0 ? void 0 : _a.displayName)); });
            if (allNamesNumeric) {
                numberFields.sort((a, b) => { var _a, _b; return parseSampleValue((_a = a.state) === null || _a === void 0 ? void 0 : _a.displayName) - parseSampleValue((_b = b.state) === null || _b === void 0 ? void 0 : _b.displayName); });
                rowsHeatmap = Object.assign(Object.assign({}, frame), { fields: [frame.fields.find((f) => f.type === FieldType.time), ...numberFields] });
            }
            else {
                rowsHeatmap = frame;
            }
        }
    }
    return getDenseHeatmapData(rowsToCellsHeatmap(Object.assign(Object.assign({ unit: (_m = options.yAxis) === null || _m === void 0 ? void 0 : _m.unit, decimals: (_o = options.yAxis) === null || _o === void 0 ? void 0 : _o.decimals }, options.rowsFrame), { frame: rowsHeatmap })), exemplars, options, palette, theme);
}
const getSparseHeatmapData = (frame, exemplars, options, palette, theme) => {
    var _a, _b, _c;
    if (((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.type) !== DataFrameType.HeatmapCells || isHeatmapCellsDense(frame)) {
        return {
            warning: 'Expected sparse heatmap format',
            heatmap: frame,
        };
    }
    // y axis tick label display
    updateFieldDisplay(frame.fields[1], options.yAxis, theme);
    const valueField = frame.fields[3];
    // cell value display
    const disp = updateFieldDisplay(valueField, options.cellValues, theme);
    let [minValue, maxValue] = boundedMinMax(valueField.values, options.color.min, options.color.max, (_b = options.filterValues) === null || _b === void 0 ? void 0 : _b.le, (_c = options.filterValues) === null || _c === void 0 ? void 0 : _c.ge);
    return {
        heatmap: frame,
        heatmapColors: {
            palette,
            values: valuesToFills(valueField.values, palette, minValue, maxValue),
            minValue,
            maxValue,
        },
        exemplars,
        display: (v) => formattedValueToString(disp(v)),
    };
};
const getDenseHeatmapData = (frame, exemplars, options, palette, theme) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    if (((_a = frame.meta) === null || _a === void 0 ? void 0 : _a.type) !== DataFrameType.HeatmapCells) {
        return {
            warning: 'Expected heatmap scanlines format',
            heatmap: frame,
        };
    }
    if (frame.fields.length < 2 || frame.length < 2) {
        return { heatmap: frame };
    }
    const meta = readHeatmapRowsCustomMeta(frame);
    let xName = undefined;
    let yName = undefined;
    let valueField = undefined;
    // validate field display properties
    for (const field of frame.fields) {
        switch (field.name) {
            case 'y':
                yName = field.name;
            case 'yMin':
            case 'yMax': {
                if (!yName) {
                    yName = field.name;
                }
                if (meta.yOrdinalDisplay == null) {
                    updateFieldDisplay(field, options.yAxis, theme);
                }
                break;
            }
            case 'x':
            case 'xMin':
            case 'xMax':
                xName = field.name;
                break;
            default: {
                if (field.type === FieldType.number && !valueField) {
                    valueField = field;
                }
            }
        }
    }
    if (!yName) {
        return { warning: 'Missing Y field', heatmap: frame };
    }
    if (!yName) {
        return { warning: 'Missing X field', heatmap: frame };
    }
    if (!valueField) {
        return { warning: 'Missing value field', heatmap: frame };
    }
    const disp = updateFieldDisplay(valueField, options.cellValues, theme);
    // infer bucket sizes from data (for now)
    // the 'heatmap-scanlines' dense frame format looks like:
    // x:      1,1,1,1,2,2,2,2
    // y:      3,4,5,6,3,4,5,6
    // count:  0,0,0,7,0,3,0,1
    const xs = frame.fields[0].values;
    const ys = frame.fields[1].values;
    const dlen = xs.length;
    // below is literally copy/paste from the pathBuilder code in utils.ts
    // detect x and y bin qtys by detecting layout repetition in x & y data
    let yBinQty = dlen - ys.lastIndexOf(ys[0]);
    let xBinQty = dlen / yBinQty;
    let yBinIncr = ys[1] - ys[0];
    let xBinIncr = xs[yBinQty] - xs[0];
    let [minValue, maxValue] = boundedMinMax(valueField.values, options.color.min, options.color.max, (_b = options.filterValues) === null || _b === void 0 ? void 0 : _b.le, (_c = options.filterValues) === null || _c === void 0 ? void 0 : _c.ge);
    let calcX = (_d = options.calculation) === null || _d === void 0 ? void 0 : _d.xBuckets;
    let calcY = (_e = options.calculation) === null || _e === void 0 ? void 0 : _e.yBuckets;
    const data = {
        heatmap: frame,
        heatmapColors: {
            palette,
            values: valuesToFills(valueField.values, palette, minValue, maxValue),
            minValue,
            maxValue,
        },
        exemplars: (exemplars === null || exemplars === void 0 ? void 0 : exemplars.length) ? exemplars : undefined,
        xBucketSize: xBinIncr,
        yBucketSize: yBinIncr,
        xBucketCount: xBinQty,
        yBucketCount: yBinQty,
        yLog: (_g = (_f = calcY === null || calcY === void 0 ? void 0 : calcY.scale) === null || _f === void 0 ? void 0 : _f.log) !== null && _g !== void 0 ? _g : 0,
        xLog: (_j = (_h = calcX === null || calcX === void 0 ? void 0 : calcX.scale) === null || _h === void 0 ? void 0 : _h.log) !== null && _j !== void 0 ? _j : 0,
        xLogSplit: ((_k = calcX === null || calcX === void 0 ? void 0 : calcX.scale) === null || _k === void 0 ? void 0 : _k.log) ? +((_l = calcX === null || calcX === void 0 ? void 0 : calcX.value) !== null && _l !== void 0 ? _l : '1') : 1,
        yLogSplit: ((_m = calcY === null || calcY === void 0 ? void 0 : calcY.scale) === null || _m === void 0 ? void 0 : _m.log) ? +((_o = calcY === null || calcY === void 0 ? void 0 : calcY.value) !== null && _o !== void 0 ? _o : '1') : 1,
        // TODO: improve heuristic
        xLayout: xName === 'xMax' ? HeatmapCellLayout.le : xName === 'xMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,
        yLayout: yName === 'yMax' ? HeatmapCellLayout.le : yName === 'yMin' ? HeatmapCellLayout.ge : HeatmapCellLayout.unknown,
        display: (v) => formattedValueToString(disp(v)),
    };
    return data;
};
function updateFieldDisplay(field, opts, theme) {
    var _a;
    if (((_a = opts === null || opts === void 0 ? void 0 : opts.unit) === null || _a === void 0 ? void 0 : _a.length) || (opts === null || opts === void 0 ? void 0 : opts.decimals) != null) {
        const { unit, decimals } = opts;
        field.display = undefined;
        field.config = Object.assign({}, field.config);
        if (unit === null || unit === void 0 ? void 0 : unit.length) {
            field.config.unit = unit;
        }
        if (decimals != null) {
            field.config.decimals = decimals;
        }
    }
    if (!field.display) {
        field.display = getDisplayProcessor({ field, theme });
    }
    return field.display;
}
//# sourceMappingURL=fields.js.map