import React, { useMemo } from 'react';
import { TooltipDisplayMode } from '@grafana/schema';
import { usePanelContext, TimeSeries, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { prepareGraphableFields } from './utils';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { config } from 'app/core/config';
export var TimeSeriesPanel = function (_a) {
    var data = _a.data, timeRange = _a.timeRange, timeZone = _a.timeZone, width = _a.width, height = _a.height, options = _a.options, fieldConfig = _a.fieldConfig, onChangeTimeRange = _a.onChangeTimeRange, replaceVariables = _a.replaceVariables;
    var _b = usePanelContext(), sync = _b.sync, canAddAnnotations = _b.canAddAnnotations, onThresholdsChange = _b.onThresholdsChange, canEditThresholds = _b.canEditThresholds, onSplitOpen = _b.onSplitOpen;
    var getFieldLinks = function (field, rowIndex) {
        return getFieldLinksForExplore({ field: field, rowIndex: rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
    };
    var _c = useMemo(function () { return prepareGraphableFields(data === null || data === void 0 ? void 0 : data.series, config.theme2); }, [data]), frames = _c.frames, warn = _c.warn;
    if (!frames || warn) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, warn !== null && warn !== void 0 ? warn : 'No data found in response')));
    }
    var enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
    return (React.createElement(TimeSeries, { frames: frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timeZone, width: width, height: height, legend: options.legend }, function (config, alignedDataFrame) {
        return (React.createElement(React.Fragment, null,
            React.createElement(ZoomPlugin, { config: config, onZoom: onChangeTimeRange }),
            options.tooltip.mode === TooltipDisplayMode.None || (React.createElement(TooltipPlugin, { data: alignedDataFrame, config: config, mode: options.tooltip.mode, sync: sync, timeZone: timeZone })),
            data.annotations && (React.createElement(AnnotationsPlugin, { annotations: data.annotations, config: config, timeZone: timeZone })),
            React.createElement(AnnotationEditorPlugin, { data: alignedDataFrame, timeZone: timeZone, config: config }, function (_a) {
                var startAnnotating = _a.startAnnotating;
                return (React.createElement(ContextMenuPlugin, { data: alignedDataFrame, config: config, timeZone: timeZone, replaceVariables: replaceVariables, defaultItems: enableAnnotationCreation
                        ? [
                            {
                                items: [
                                    {
                                        label: 'Add annotation',
                                        ariaLabel: 'Add annotation',
                                        icon: 'comment-alt',
                                        onClick: function (e, p) {
                                            if (!p) {
                                                return;
                                            }
                                            startAnnotating({ coords: p.coords });
                                        },
                                    },
                                ],
                            },
                        ]
                        : [] }));
            }),
            data.annotations && (React.createElement(ExemplarsPlugin, { config: config, exemplars: data.annotations, timeZone: timeZone, getFieldLinks: getFieldLinks })),
            canEditThresholds && onThresholdsChange && (React.createElement(ThresholdControlsPlugin, { config: config, fieldConfig: fieldConfig, onThresholdsChange: onThresholdsChange }))));
    }));
};
//# sourceMappingURL=TimeSeriesPanel.js.map