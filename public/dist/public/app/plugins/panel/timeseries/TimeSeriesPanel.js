import React, { useMemo } from 'react';
import { DataFrameType } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { KeyboardPlugin, TimeSeries, TooltipPlugin, usePanelContext, ZoomPlugin } from '@grafana/ui';
import { config } from 'app/core/config';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, prepareGraphableFields, regenerateLinksSupplier } from './utils';
export const TimeSeriesPanel = ({ data, timeRange, timeZone, width, height, options, fieldConfig, onChangeTimeRange, replaceVariables, id, }) => {
    const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, showThresholds, dataLinkPostProcessor } = usePanelContext();
    const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2, timeRange), [data.series, timeRange]);
    const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
    const suggestions = useMemo(() => {
        if ((frames === null || frames === void 0 ? void 0 : frames.length) && frames.every((df) => { var _a; return ((_a = df.meta) === null || _a === void 0 ? void 0 : _a.type) === DataFrameType.TimeSeriesLong; })) {
            const s = getPrepareTimeseriesSuggestion(id);
            return {
                message: 'Long data must be converted to wide',
                suggestions: s ? [s] : undefined,
            };
        }
        return undefined;
    }, [frames, id]);
    if (!frames || suggestions) {
        return (React.createElement(PanelDataErrorView, { panelId: id, message: suggestions === null || suggestions === void 0 ? void 0 : suggestions.message, fieldConfig: fieldConfig, data: data, needsTimeField: true, needsNumberField: true, suggestions: suggestions === null || suggestions === void 0 ? void 0 : suggestions.suggestions }));
    }
    const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
    return (React.createElement(TimeSeries, { frames: frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timezones, width: width, height: height, legend: options.legend, options: options }, (config, alignedDataFrame) => {
        if (alignedDataFrame.fields.some((f) => { var _a; return Boolean((_a = f.config.links) === null || _a === void 0 ? void 0 : _a.length); })) {
            alignedDataFrame = regenerateLinksSupplier(alignedDataFrame, frames, replaceVariables, timeZone, dataLinkPostProcessor);
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(KeyboardPlugin, { config: config }),
            React.createElement(ZoomPlugin, { config: config, onZoom: onChangeTimeRange, withZoomY: true }),
            options.tooltip.mode === TooltipDisplayMode.None || (React.createElement(TooltipPlugin, { frames: frames, data: alignedDataFrame, config: config, mode: options.tooltip.mode, sortOrder: options.tooltip.sort, sync: sync, timeZone: timeZone })),
            data.annotations && (React.createElement(AnnotationsPlugin, { annotations: data.annotations, config: config, timeZone: timeZone })),
            enableAnnotationCreation ? (React.createElement(AnnotationEditorPlugin, { data: alignedDataFrame, timeZone: timeZone, config: config }, ({ startAnnotating }) => {
                return (React.createElement(ContextMenuPlugin, { data: alignedDataFrame, config: config, timeZone: timeZone, replaceVariables: replaceVariables, defaultItems: [
                        {
                            items: [
                                {
                                    label: 'Add annotation',
                                    ariaLabel: 'Add annotation',
                                    icon: 'comment-alt',
                                    onClick: (e, p) => {
                                        if (!p) {
                                            return;
                                        }
                                        startAnnotating({ coords: p.coords });
                                    },
                                },
                            ],
                        },
                    ] }));
            })) : (React.createElement(ContextMenuPlugin, { data: alignedDataFrame, frames: frames, config: config, timeZone: timeZone, replaceVariables: replaceVariables, defaultItems: [] })),
            data.annotations && (React.createElement(ExemplarsPlugin, { visibleSeries: getVisibleLabels(config, frames), config: config, exemplars: data.annotations, timeZone: timeZone })),
            ((canEditThresholds && onThresholdsChange) || showThresholds) && (React.createElement(ThresholdControlsPlugin, { config: config, fieldConfig: fieldConfig, onThresholdsChange: canEditThresholds ? onThresholdsChange : undefined })),
            React.createElement(OutsideRangePlugin, { config: config, onChangeTimeRange: onChangeTimeRange })));
    }));
};
//# sourceMappingURL=TimeSeriesPanel.js.map