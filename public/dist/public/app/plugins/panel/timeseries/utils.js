import { ArrayVector, FieldType, getDisplayProcessor, getLinksSupplier, isBooleanUnit, SortedVector, } from '@grafana/data';
import { convertFieldType } from '@grafana/data/src/transformations/transformers/convertFieldType';
import { LineInterpolation } from '@grafana/schema';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';
import { nullToValue } from '@grafana/ui/src/components/GraphNG/nullToValue';
import { buildScaleKey } from '@grafana/ui/src/components/GraphNG/utils';
// this will re-enumerate all enum fields on the same scale to create one ordinal progression
// e.g. ['a','b'][0,1,0] + ['c','d'][1,0,1] -> ['a','b'][0,1,0] + ['c','d'][3,2,3]
function reEnumFields(frames) {
    let allTextsByKey = new Map();
    let frames2 = frames.map((frame) => {
        return Object.assign(Object.assign({}, frame), { fields: frame.fields.map((field) => {
                if (field.type === FieldType.enum) {
                    let scaleKey = buildScaleKey(field.config, field.type);
                    let allTexts = allTextsByKey.get(scaleKey);
                    if (!allTexts) {
                        allTexts = [];
                        allTextsByKey.set(scaleKey, allTexts);
                    }
                    let idxs = field.values.toArray().slice();
                    let txts = field.config.type.enum.text;
                    // by-reference incrementing
                    if (allTexts.length > 0) {
                        for (let i = 0; i < idxs.length; i++) {
                            idxs[i] += allTexts.length;
                        }
                    }
                    allTexts.push(...txts);
                    // shared among all enum fields on same scale
                    field.config.type.enum.text = allTexts;
                    return Object.assign(Object.assign({}, field), { values: new ArrayVector(idxs) });
                    // TODO: update displayProcessor?
                }
                return field;
            }) });
    });
    return frames2;
}
/**
 * Returns null if there are no graphable fields
 */
export function prepareGraphableFields(series, theme, timeRange, 
// numeric X requires a single frame where the first field is numeric
xNumFieldIdx) {
    var _a, _b, _c;
    if (!(series === null || series === void 0 ? void 0 : series.length)) {
        return null;
    }
    let useNumericX = xNumFieldIdx != null;
    // Make sure the numeric x field is first in the frame
    if (xNumFieldIdx != null && xNumFieldIdx > 0) {
        series = [
            Object.assign(Object.assign({}, series[0]), { fields: [series[0].fields[xNumFieldIdx], ...series[0].fields.filter((f, i) => i !== xNumFieldIdx)] }),
        ];
    }
    // some datasources simply tag the field as time, but don't convert to milli epochs
    // so we're stuck with doing the parsing here to avoid Moment slowness everywhere later
    // this mutates (once)
    for (let frame of series) {
        for (let field of frame.fields) {
            if (field.type === FieldType.time && typeof field.values[0] !== 'number') {
                field.values = convertFieldType(field, { destinationType: FieldType.time }).values;
            }
        }
    }
    let enumFieldsCount = 0;
    loopy: for (let frame of series) {
        for (let field of frame.fields) {
            if (field.type === FieldType.enum && ++enumFieldsCount > 1) {
                series = reEnumFields(series);
                break loopy;
            }
        }
    }
    let copy;
    const frames = [];
    for (let frame of series) {
        const fields = [];
        let hasTimeField = false;
        let hasValueField = false;
        let nulledFrame = useNumericX
            ? frame
            : applyNullInsertThreshold({
                frame,
                refFieldPseudoMin: timeRange === null || timeRange === void 0 ? void 0 : timeRange.from.valueOf(),
                refFieldPseudoMax: timeRange === null || timeRange === void 0 ? void 0 : timeRange.to.valueOf(),
            });
        const frameFields = nullToValue(nulledFrame).fields;
        for (let fieldIdx = 0; (_a = fieldIdx < (frameFields === null || frameFields === void 0 ? void 0 : frameFields.length)) !== null && _a !== void 0 ? _a : 0; fieldIdx++) {
            const field = frameFields[fieldIdx];
            switch (field.type) {
                case FieldType.time:
                    hasTimeField = true;
                    fields.push(field);
                    break;
                case FieldType.number:
                    hasValueField = useNumericX ? fieldIdx > 0 : true;
                    copy = Object.assign(Object.assign({}, field), { values: field.values.map((v) => {
                            if (!(Number.isFinite(v) || v == null)) {
                                return null;
                            }
                            return v;
                        }) });
                    fields.push(copy);
                    break; // ok
                case FieldType.enum:
                    hasValueField = true;
                case FieldType.string:
                    copy = Object.assign(Object.assign({}, field), { values: field.values });
                    fields.push(copy);
                    break; // ok
                case FieldType.boolean:
                    hasValueField = true;
                    const custom = (_c = (_b = field.config) === null || _b === void 0 ? void 0 : _b.custom) !== null && _c !== void 0 ? _c : {};
                    const config = Object.assign(Object.assign({}, field.config), { max: 1, min: 0, custom });
                    // smooth and linear do not make sense
                    if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
                        custom.lineInterpolation = LineInterpolation.StepAfter;
                    }
                    copy = Object.assign(Object.assign({}, field), { config, type: FieldType.number, values: field.values.map((v) => {
                            if (v == null) {
                                return v;
                            }
                            return Boolean(v) ? 1 : 0;
                        }) });
                    if (!isBooleanUnit(config.unit)) {
                        config.unit = 'bool';
                        copy.display = getDisplayProcessor({ field: copy, theme });
                    }
                    fields.push(copy);
                    break;
            }
        }
        if ((useNumericX || hasTimeField) && hasValueField) {
            frames.push(Object.assign(Object.assign({}, frame), { length: nulledFrame.length, fields }));
        }
    }
    if (frames.length) {
        setClassicPaletteIdxs(frames, theme, 0);
        matchEnumColorToSeriesColor(frames, theme);
        return frames;
    }
    return null;
}
const matchEnumColorToSeriesColor = (frames, theme) => {
    var _a;
    const { palette } = theme.visualization;
    for (const frame of frames) {
        for (const field of frame.fields) {
            if (field.type === FieldType.enum) {
                const namedColor = palette[((_a = field.state) === null || _a === void 0 ? void 0 : _a.seriesIndex) % palette.length];
                const hexColor = theme.visualization.getColorByName(namedColor);
                const enumConfig = field.config.type.enum;
                enumConfig.color = Array(enumConfig.text.length).fill(hexColor);
                field.display = getDisplayProcessor({ field, theme });
            }
        }
    }
};
const setClassicPaletteIdxs = (frames, theme, skipFieldIdx) => {
    let seriesIndex = 0;
    frames.forEach((frame) => {
        frame.fields.forEach((field, fieldIdx) => {
            if (fieldIdx !== skipFieldIdx &&
                (field.type === FieldType.number || field.type === FieldType.boolean || field.type === FieldType.enum)) {
                field.state = Object.assign(Object.assign({}, field.state), { seriesIndex: seriesIndex++ });
                field.display = getDisplayProcessor({ field, theme });
            }
        });
    });
};
export function getTimezones(timezones, defaultTimezone) {
    if (!timezones || !timezones.length) {
        return [defaultTimezone];
    }
    return timezones.map((v) => ((v === null || v === void 0 ? void 0 : v.length) ? v : defaultTimezone));
}
export function regenerateLinksSupplier(alignedDataFrame, frames, replaceVariables, timeZone, dataLinkPostProcessor) {
    alignedDataFrame.fields.forEach((field) => {
        var _a, _b, _c, _d, _e, _f;
        if (((_b = (_a = field.state) === null || _a === void 0 ? void 0 : _a.origin) === null || _b === void 0 ? void 0 : _b.frameIndex) === undefined || frames[(_d = (_c = field.state) === null || _c === void 0 ? void 0 : _c.origin) === null || _d === void 0 ? void 0 : _d.frameIndex] === undefined) {
            return;
        }
        /* check if field has sortedVector values
          if it does, sort all string fields in the original frame by the order array already used for the field
          otherwise just attach the fields to the temporary frame used to get the links
        */
        const tempFields = [];
        for (const frameField of frames[(_f = (_e = field.state) === null || _e === void 0 ? void 0 : _e.origin) === null || _f === void 0 ? void 0 : _f.frameIndex].fields) {
            if (frameField.type === FieldType.string) {
                if (field.values instanceof SortedVector) {
                    const copiedField = Object.assign({}, frameField);
                    copiedField.values = new SortedVector(frameField.values, field.values.getOrderArray());
                    tempFields.push(copiedField);
                }
                else {
                    tempFields.push(frameField);
                }
            }
        }
        const tempFrame = {
            fields: [...alignedDataFrame.fields, ...tempFields],
            length: alignedDataFrame.fields.length + tempFields.length,
        };
        field.getLinks = getLinksSupplier(tempFrame, field, field.state.scopedVars, replaceVariables, timeZone, dataLinkPostProcessor);
    });
    return alignedDataFrame;
}
//# sourceMappingURL=utils.js.map