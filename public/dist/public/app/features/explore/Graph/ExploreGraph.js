import { identity } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { applyFieldOverrides, createFieldConfigRegistry, dateTime, FieldColorModeId, getFrameDisplayName, DashboardCursorSync, } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, SortOrder, } from '@grafana/schema';
import { PanelContextProvider, useTheme2 } from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { seriesVisibilityConfigFactory } from '../../dashboard/dashgrid/SeriesVisibilityConfigFactory';
import { useExploreDataLinkPostProcessor } from '../hooks/useExploreDataLinkPostProcessor';
import { applyGraphStyle, applyThresholdsConfig } from './exploreGraphStyleUtils';
import { useStructureRev } from './useStructureRev';
export function ExploreGraph({ data, height, width, timeZone, absoluteRange, onChangeTime, loadingState, annotations, onHiddenSeriesChanged, splitOpenFn, graphStyle, tooltipDisplayMode = TooltipDisplayMode.Single, anchorToZero = false, yAxisMaximum, thresholdsConfig, thresholdsStyle, eventBus, }) {
    const theme = useTheme2();
    const timeRange = useMemo(() => ({
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
        raw: {
            from: dateTime(absoluteRange.from),
            to: dateTime(absoluteRange.to),
        },
    }), [absoluteRange.from, absoluteRange.to]);
    const fieldConfigRegistry = useMemo(() => createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore'), []);
    const [fieldConfig, setFieldConfig] = useState({
        defaults: {
            min: anchorToZero ? 0 : undefined,
            max: yAxisMaximum || undefined,
            unit: 'short',
            color: {
                mode: FieldColorModeId.PaletteClassic,
            },
            custom: {
                drawStyle: GraphDrawStyle.Line,
                fillOpacity: 0,
                pointSize: 5,
            },
        },
        overrides: [],
    });
    const styledFieldConfig = useMemo(() => {
        const withGraphStyle = applyGraphStyle(fieldConfig, graphStyle, yAxisMaximum);
        return applyThresholdsConfig(withGraphStyle, thresholdsStyle, thresholdsConfig);
    }, [fieldConfig, graphStyle, yAxisMaximum, thresholdsConfig, thresholdsStyle]);
    const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);
    const dataWithConfig = useMemo(() => {
        return applyFieldOverrides({
            fieldConfig: styledFieldConfig,
            data,
            timeZone,
            replaceVariables: (value) => value,
            theme,
            fieldConfigRegistry,
            dataLinkPostProcessor,
        });
    }, [fieldConfigRegistry, data, timeZone, theme, styledFieldConfig, dataLinkPostProcessor]);
    const annotationsWithConfig = useMemo(() => {
        return applyFieldOverrides({
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
            data: annotations,
            timeZone,
            replaceVariables: (value) => value,
            theme,
            dataLinkPostProcessor,
        });
    }, [annotations, timeZone, theme, dataLinkPostProcessor]);
    const structureRev = useStructureRev(dataWithConfig);
    useEffect(() => {
        if (onHiddenSeriesChanged) {
            const hiddenFrames = [];
            dataWithConfig.forEach((frame) => {
                const allFieldsHidden = frame.fields.map((field) => { var _a, _b, _c; return (_c = (_b = (_a = field.config) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.hideFrom) === null || _c === void 0 ? void 0 : _c.viz; }).every(identity);
                if (allFieldsHidden) {
                    hiddenFrames.push(getFrameDisplayName(frame));
                }
            });
            onHiddenSeriesChanged(hiddenFrames);
        }
    }, [dataWithConfig, onHiddenSeriesChanged]);
    const panelContext = {
        eventsScope: 'explore',
        eventBus,
        sync: () => DashboardCursorSync.Crosshair,
        onToggleSeriesVisibility(label, mode) {
            setFieldConfig(seriesVisibilityConfigFactory(label, mode, fieldConfig, data));
        },
        dataLinkPostProcessor,
    };
    const panelOptions = useMemo(() => ({
        tooltip: { mode: tooltipDisplayMode, sort: SortOrder.None },
        legend: {
            displayMode: LegendDisplayMode.List,
            showLegend: true,
            placement: 'bottom',
            calcs: [],
        },
    }), [tooltipDisplayMode]);
    return (React.createElement(PanelContextProvider, { value: panelContext },
        React.createElement(PanelRenderer, { data: {
                series: dataWithConfig,
                timeRange,
                state: loadingState,
                annotations: annotationsWithConfig,
                structureRev,
            }, pluginId: "timeseries", title: "", width: width, height: height, onChangeTimeRange: onChangeTime, timeZone: timeZone, options: panelOptions })));
}
//# sourceMappingURL=ExploreGraph.js.map