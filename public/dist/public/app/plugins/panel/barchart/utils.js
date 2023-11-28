import uPlot from 'uplot';
import { FieldType, formattedValueToString, getDisplayProcessor, getFieldColorModeForField, cacheFieldDisplayNames, getFieldSeriesColor, outerJoinDataFrames, VizOrientation, } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { AxisColorMode, AxisPlacement, GraphTransform, GraphTresholdsStyleMode, ScaleDirection, ScaleDistribution, ScaleOrientation, StackingMode, } from '@grafana/schema';
import { FIXED_UNIT, measureText, UPlotConfigBuilder, UPLOT_AXIS_FONT_SIZE } from '@grafana/ui';
import { getStackingGroups } from '@grafana/ui/src/components/uPlot/utils';
import { findField } from 'app/features/dimensions';
import { getConfig } from './bars';
import { defaultFieldConfig } from './panelcfg.gen';
function getBarCharScaleOrientation(orientation) {
    if (orientation === VizOrientation.Vertical) {
        return {
            xOri: ScaleOrientation.Horizontal,
            xDir: ScaleDirection.Right,
            yOri: ScaleOrientation.Vertical,
            yDir: ScaleDirection.Up,
        };
    }
    return {
        xOri: ScaleOrientation.Vertical,
        xDir: ScaleDirection.Down,
        yOri: ScaleOrientation.Horizontal,
        yDir: ScaleDirection.Right,
    };
}
export const preparePlotConfigBuilder = ({ frame, theme, orientation, showValue, groupWidth, barWidth, barRadius = 0, stacking, text, rawValue, getColor, fillOpacity, allFrames, xTickLabelRotation, xTickLabelMaxLength, xTickLabelSpacing = 0, legend, timeZone, fullHighlight, }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const builder = new UPlotConfigBuilder();
    const formatValue = (seriesIdx, value) => {
        return formattedValueToString(frame.fields[seriesIdx].display(value));
    };
    const formatShortValue = (seriesIdx, value) => {
        return shortenValue(formatValue(seriesIdx, value), xTickLabelMaxLength);
    };
    // bar orientation -> x scale orientation & direction
    const vizOrientation = getBarCharScaleOrientation(orientation);
    // Use bar width when only one field
    if (frame.fields.length === 2) {
        groupWidth = barWidth;
        barWidth = 1;
    }
    const opts = {
        xOri: vizOrientation.xOri,
        xDir: vizOrientation.xDir,
        groupWidth,
        barWidth,
        barRadius,
        stacking,
        rawValue,
        getColor,
        fillOpacity,
        formatValue,
        formatShortValue,
        timeZone,
        text,
        showValue,
        legend,
        xSpacing: xTickLabelSpacing,
        xTimeAuto: ((_a = frame.fields[0]) === null || _a === void 0 ? void 0 : _a.type) === FieldType.time && !((_b = frame.fields[0].config.unit) === null || _b === void 0 ? void 0 : _b.startsWith('time:')),
        negY: frame.fields.map((f) => { var _a; return ((_a = f.config.custom) === null || _a === void 0 ? void 0 : _a.transform) === GraphTransform.NegativeY; }),
        fullHighlight,
    };
    const config = getConfig(opts, theme);
    builder.setCursor(config.cursor);
    builder.addHook('init', config.init);
    builder.addHook('drawClear', config.drawClear);
    builder.addHook('draw', config.draw);
    builder.setTooltipInterpolator(config.interpolateTooltip);
    if (xTickLabelRotation !== 0) {
        // these are the amount of space we already have available between plot edge and first label
        // TODO: removing these hardcoded value requires reading back uplot instance props
        let lftSpace = 50;
        let btmSpace = vizOrientation.xOri === ScaleOrientation.Horizontal ? 14 : 5;
        builder.setPadding(getRotationPadding(frame, xTickLabelRotation, xTickLabelMaxLength, lftSpace, btmSpace));
    }
    builder.setPrepData(config.prepData);
    builder.addScale({
        scaleKey: 'x',
        isTime: false,
        range: config.xRange,
        distribution: ScaleDistribution.Ordinal,
        orientation: vizOrientation.xOri,
        direction: vizOrientation.xDir,
    });
    const xFieldAxisPlacement = ((_c = frame.fields[0].config.custom) === null || _c === void 0 ? void 0 : _c.axisPlacement) !== AxisPlacement.Hidden
        ? vizOrientation.xOri === ScaleOrientation.Horizontal
            ? AxisPlacement.Bottom
            : AxisPlacement.Left
        : AxisPlacement.Hidden;
    const xFieldAxisShow = ((_d = frame.fields[0].config.custom) === null || _d === void 0 ? void 0 : _d.axisPlacement) !== AxisPlacement.Hidden;
    builder.addAxis({
        scaleKey: 'x',
        isTime: false,
        placement: xFieldAxisPlacement,
        label: (_e = frame.fields[0].config.custom) === null || _e === void 0 ? void 0 : _e.axisLabel,
        splits: config.xSplits,
        filter: vizOrientation.xOri === 0 ? config.hFilter : undefined,
        values: config.xValues,
        timeZone,
        grid: { show: false },
        ticks: { show: false },
        gap: 15,
        tickLabelRotation: vizOrientation.xOri === 0 ? xTickLabelRotation * -1 : 0,
        theme,
        show: xFieldAxisShow,
    });
    let seriesIndex = 0;
    const legendOrdered = isLegendOrdered(legend);
    // iterate the y values
    for (let i = 1; i < frame.fields.length; i++) {
        const field = frame.fields[i];
        seriesIndex++;
        const customConfig = Object.assign(Object.assign({}, defaultFieldConfig), field.config.custom);
        const scaleKey = field.config.unit || FIXED_UNIT;
        const colorMode = getFieldColorModeForField(field);
        const scaleColor = getFieldSeriesColor(field, theme);
        const seriesColor = scaleColor.color;
        // make barcharts start at 0 unless explicitly overridden
        let softMin = customConfig.axisSoftMin;
        let softMax = customConfig.axisSoftMax;
        if (softMin == null && field.config.min == null) {
            softMin = 0;
        }
        if (softMax == null && field.config.max == null) {
            softMax = 0;
        }
        // Render thresholds in graph
        if (customConfig.thresholdsStyle && field.config.thresholds) {
            const thresholdDisplay = (_f = customConfig.thresholdsStyle.mode) !== null && _f !== void 0 ? _f : GraphTresholdsStyleMode.Off;
            if (thresholdDisplay !== GraphTresholdsStyleMode.Off) {
                builder.addThresholds({
                    config: customConfig.thresholdsStyle,
                    thresholds: field.config.thresholds,
                    scaleKey,
                    theme,
                    hardMin: field.config.min,
                    hardMax: field.config.max,
                    softMin: customConfig.axisSoftMin,
                    softMax: customConfig.axisSoftMax,
                });
            }
        }
        builder.addSeries({
            scaleKey,
            pxAlign: true,
            lineWidth: customConfig.lineWidth,
            lineColor: seriesColor,
            fillOpacity: customConfig.fillOpacity,
            theme,
            colorMode,
            pathBuilder: config.barsBuilder,
            show: !((_g = customConfig.hideFrom) === null || _g === void 0 ? void 0 : _g.viz),
            gradientMode: customConfig.gradientMode,
            thresholds: field.config.thresholds,
            hardMin: field.config.min,
            hardMax: field.config.max,
            softMin: customConfig.axisSoftMin,
            softMax: customConfig.axisSoftMax,
            // The following properties are not used in the uPlot config, but are utilized as transport for legend config
            // PlotLegend currently gets unfiltered DataFrame[], so index must be into that field array, not the prepped frame's which we're iterating here
            dataFrameFieldIndex: {
                fieldIndex: legendOrdered
                    ? i
                    : allFrames[0].fields.findIndex((f) => { var _a; return f.type === FieldType.number && ((_a = f.state) === null || _a === void 0 ? void 0 : _a.seriesIndex) === seriesIndex - 1; }),
                frameIndex: 0,
            },
        });
        // The builder will manage unique scaleKeys and combine where appropriate
        builder.addScale({
            scaleKey,
            min: field.config.min,
            max: field.config.max,
            softMin,
            softMax,
            centeredZero: customConfig.axisCenteredZero,
            orientation: vizOrientation.yOri,
            direction: vizOrientation.yDir,
            distribution: (_h = customConfig.scaleDistribution) === null || _h === void 0 ? void 0 : _h.type,
            log: (_j = customConfig.scaleDistribution) === null || _j === void 0 ? void 0 : _j.log,
        });
        if (customConfig.axisPlacement !== AxisPlacement.Hidden) {
            let placement = customConfig.axisPlacement;
            if (!placement || placement === AxisPlacement.Auto) {
                placement = AxisPlacement.Left;
            }
            if (vizOrientation.xOri === 1) {
                if (placement === AxisPlacement.Left) {
                    placement = AxisPlacement.Bottom;
                }
                if (placement === AxisPlacement.Right) {
                    placement = AxisPlacement.Top;
                }
            }
            let axisOpts = {
                scaleKey,
                label: customConfig.axisLabel,
                size: customConfig.axisWidth,
                placement,
                formatValue: (v, decimals) => formattedValueToString(field.display(v, decimals)),
                filter: vizOrientation.yOri === 0 ? config.hFilter : undefined,
                tickLabelRotation: vizOrientation.xOri === 1 ? xTickLabelRotation * -1 : 0,
                theme,
                grid: { show: customConfig.axisGridShow },
            };
            if (customConfig.axisBorderShow) {
                axisOpts.border = {
                    show: true,
                };
            }
            if (customConfig.axisColorMode === AxisColorMode.Series) {
                axisOpts.color = seriesColor;
            }
            builder.addAxis(axisOpts);
        }
    }
    let stackingGroups = getStackingGroups(frame);
    builder.setStackingGroups(stackingGroups);
    return builder;
};
function shortenValue(value, length) {
    if (value.length > length) {
        return value.substring(0, length).concat('...');
    }
    else {
        return value;
    }
}
function getRotationPadding(frame, rotateLabel, valueMaxLength, lftSpace = 0, btmSpace = 0) {
    const values = frame.fields[0].values;
    const fontSize = UPLOT_AXIS_FONT_SIZE;
    const displayProcessor = frame.fields[0].display;
    const getProcessedValue = (i) => {
        return displayProcessor ? displayProcessor(values[i]) : values[i];
    };
    let maxLength = 0;
    for (let i = 0; i < values.length; i++) {
        let size = measureText(shortenValue(formattedValueToString(getProcessedValue(i)), valueMaxLength), fontSize);
        maxLength = size.width > maxLength ? size.width : maxLength;
    }
    // Add padding to the right if the labels are rotated in a way that makes the last label extend outside the graph.
    const paddingRight = rotateLabel > 0
        ? Math.cos((rotateLabel * Math.PI) / 180) *
            measureText(shortenValue(formattedValueToString(getProcessedValue(values.length - 1)), valueMaxLength), fontSize).width
        : 0;
    // Add padding to the left if the labels are rotated in a way that makes the first label extend outside the graph.
    const paddingLeft = rotateLabel < 0
        ? Math.cos((rotateLabel * -1 * Math.PI) / 180) *
            measureText(shortenValue(formattedValueToString(getProcessedValue(0)), valueMaxLength), fontSize).width
        : 0;
    // Add padding to the bottom to avoid clipping the rotated labels.
    const paddingBottom = Math.sin(((rotateLabel >= 0 ? rotateLabel : rotateLabel * -1) * Math.PI) / 180) * maxLength - btmSpace;
    return [
        Math.round(UPLOT_AXIS_FONT_SIZE * uPlot.pxRatio),
        paddingRight,
        paddingBottom,
        Math.max(0, paddingLeft - lftSpace),
    ];
}
/** @internal */
export function prepareBarChartDisplayValues(series, theme, options) {
    if (!(series === null || series === void 0 ? void 0 : series.length)) {
        return { warn: 'No data in response' };
    }
    cacheFieldDisplayNames(series);
    // Bar chart requires a single frame
    const frame = series.length === 1
        ? maybeSortFrame(series[0], series[0].fields.findIndex((f) => f.type === FieldType.time))
        : outerJoinDataFrames({ frames: series });
    if (!frame) {
        return { warn: 'Unable to join data' };
    }
    // Color by a field different than the input
    let colorByField = undefined;
    if (options.colorByField) {
        colorByField = findField(frame, options.colorByField);
        if (!colorByField) {
            return { warn: 'Color field not found' };
        }
    }
    let xField = undefined;
    if (options.xField) {
        xField = findField(frame, options.xField);
        if (!xField) {
            return { warn: 'Configured x field not found' };
        }
    }
    let stringField = undefined;
    let timeField = undefined;
    let fields = [];
    for (const field of frame.fields) {
        if (field === xField) {
            continue;
        }
        switch (field.type) {
            case FieldType.string:
                if (!stringField) {
                    stringField = field;
                }
                break;
            case FieldType.time:
                if (!timeField) {
                    timeField = field;
                }
                break;
            case FieldType.number: {
                const copy = Object.assign(Object.assign({}, field), { state: Object.assign(Object.assign({}, field.state), { seriesIndex: fields.length }), config: Object.assign(Object.assign({}, field.config), { custom: Object.assign(Object.assign({}, field.config.custom), { stacking: {
                                group: '_',
                                mode: options.stacking,
                            } }) }), values: field.values.map((v) => {
                        if (!(Number.isFinite(v) || v == null)) {
                            return null;
                        }
                        return v;
                    }) });
                if (options.stacking === StackingMode.Percent) {
                    copy.config.unit = 'percentunit';
                    copy.display = getDisplayProcessor({ field: copy, theme });
                }
                fields.push(copy);
            }
        }
    }
    let firstField = xField;
    if (!firstField) {
        firstField = stringField || timeField;
    }
    if (!firstField) {
        return {
            warn: 'Bar charts requires a string or time field',
        };
    }
    if (!fields.length) {
        return {
            warn: 'No numeric fields found',
        };
    }
    // Show the first number value
    if (colorByField && fields.length > 1) {
        const firstNumber = fields.find((f) => f !== colorByField);
        if (firstNumber) {
            fields = [firstNumber];
        }
    }
    let legendFields = fields;
    if (options.stacking === StackingMode.Percent) {
        legendFields = fields.map((field) => {
            const alignedFrameField = frame.fields.find((f) => { var _a, _b; return ((_a = f.state) === null || _a === void 0 ? void 0 : _a.displayName) === ((_b = field.state) === null || _b === void 0 ? void 0 : _b.displayName); });
            const copy = Object.assign(Object.assign({}, field), { config: Object.assign({}, alignedFrameField.config), values: field.values });
            copy.display = getDisplayProcessor({ field: copy, theme });
            return copy;
        });
        legendFields.unshift(firstField);
    }
    // String field is first
    fields.unshift(firstField);
    return {
        aligned: frame,
        colorByField,
        viz: [
            {
                length: firstField.values.length,
                fields: fields, // ideally: fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.viz)),
            },
        ],
        legend: {
            fields: legendFields,
            length: firstField.values.length,
        },
    };
}
export const isLegendOrdered = (options) => Boolean((options === null || options === void 0 ? void 0 : options.sortBy) && options.sortDesc !== null);
//# sourceMappingURL=utils.js.map