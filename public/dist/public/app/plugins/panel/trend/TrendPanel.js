import React, { useMemo } from 'react';
import { FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { isLikelyAscendingVector } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { KeyboardPlugin, preparePlotFrame, TimeSeries, TooltipDisplayMode, TooltipPlugin, usePanelContext, } from '@grafana/ui';
import { findFieldIndex } from 'app/features/dimensions';
import { prepareGraphableFields, regenerateLinksSupplier } from '../timeseries/utils';
export const TrendPanel = ({ data, timeRange, timeZone, width, height, options, fieldConfig, replaceVariables, id, }) => {
    var _a, _b;
    const { sync, dataLinkPostProcessor } = usePanelContext();
    // Need to fallback to first number field if no xField is set in options otherwise panel crashes 😬
    const trendXFieldName = (_a = options.xField) !== null && _a !== void 0 ? _a : (_b = data.series[0].fields.find((field) => field.type === FieldType.number)) === null || _b === void 0 ? void 0 : _b.name;
    const preparePlotFrameTimeless = (frames, dimFields, timeRange) => {
        dimFields = Object.assign(Object.assign({}, dimFields), { x: fieldMatchers.get(FieldMatcherID.byName).get(trendXFieldName) });
        return preparePlotFrame(frames, dimFields);
    };
    const info = useMemo(() => {
        if (data.series.length > 1) {
            return {
                warning: 'Only one frame is supported, consider adding a join transformation',
                frames: data.series,
            };
        }
        let frames = data.series;
        let xFieldIdx;
        if (options.xField) {
            xFieldIdx = findFieldIndex(frames[0], options.xField);
            if (xFieldIdx == null) {
                return {
                    warning: 'Unable to find field: ' + options.xField,
                    frames: data.series,
                };
            }
        }
        else {
            // first number field
            // Perhaps we can/should support any ordinal rather than an error here
            xFieldIdx = frames[0].fields.findIndex((f) => f.type === FieldType.number);
            if (xFieldIdx === -1) {
                return {
                    warning: 'No numeric fields found for X axis',
                    frames,
                };
            }
        }
        // Make sure values are ascending
        if (xFieldIdx != null) {
            const field = frames[0].fields[xFieldIdx];
            if (field.type === FieldType.number && !isLikelyAscendingVector(field.values)) {
                return {
                    warning: `Values must be in ascending order`,
                    frames,
                };
            }
        }
        return { frames: prepareGraphableFields(frames, config.theme2, undefined, xFieldIdx) };
    }, [data.series, options.xField]);
    if (info.warning || !info.frames) {
        return (React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data, message: info.warning, needsNumberField: true }));
    }
    return (React.createElement(TimeSeries // Name change!
    , { frames: info.frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timeZone, width: width, height: height, legend: options.legend, options: options, preparePlotFrame: preparePlotFrameTimeless }, (config, alignedDataFrame) => {
        if (alignedDataFrame.fields.some((f) => { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); })) {
            alignedDataFrame = regenerateLinksSupplier(alignedDataFrame, info.frames, replaceVariables, timeZone, dataLinkPostProcessor);
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(KeyboardPlugin, { config: config }),
            options.tooltip.mode === TooltipDisplayMode.None || (React.createElement(TooltipPlugin, { frames: info.frames, data: alignedDataFrame, config: config, mode: options.tooltip.mode, sortOrder: options.tooltip.sort, sync: sync, timeZone: timeZone }))));
    }));
};
//# sourceMappingURL=TrendPanel.js.map