import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DataFrameType, getLinksSupplier } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Portal, ScaleDistribution, UPlotChart, usePanelContext, useStyles2, useTheme2, VizLayout, VizTooltipContainer, } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { ExemplarModalHeader } from './ExemplarModalHeader';
import { HeatmapHoverView } from './HeatmapHoverView';
import { prepareHeatmapData } from './fields';
import { quantizeScheme } from './palettes';
import { prepConfig } from './utils';
export const HeatmapPanel = ({ data, id, timeRange, timeZone, width, height, options, fieldConfig, eventBus, onChangeTimeRange, replaceVariables, }) => {
    var _a;
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const { sync } = usePanelContext();
    //  necessary for enabling datalinks in hover view
    let scopedVarsFromRawData = [];
    for (const series of data.series) {
        for (const field of series.fields) {
            if ((_a = field.state) === null || _a === void 0 ? void 0 : _a.scopedVars) {
                scopedVarsFromRawData.push(field.state.scopedVars);
            }
        }
    }
    // ugh
    let timeRangeRef = useRef(timeRange);
    timeRangeRef.current = timeRange;
    const getFieldLinksSupplier = useCallback((exemplars, field) => {
        var _a, _b;
        return getLinksSupplier(exemplars, field, (_b = (_a = field.state) === null || _a === void 0 ? void 0 : _a.scopedVars) !== null && _b !== void 0 ? _b : {}, replaceVariables);
    }, [replaceVariables]);
    const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);
    const info = useMemo(() => {
        try {
            return prepareHeatmapData(data.series, data.annotations, options, palette, theme, getFieldLinksSupplier, replaceVariables);
        }
        catch (ex) {
            return { warning: `${ex}` };
        }
    }, [data.series, data.annotations, options, palette, theme, getFieldLinksSupplier, replaceVariables]);
    const facets = useMemo(() => {
        var _a, _b, _c, _d, _e;
        let exemplarsXFacet = []; // "Time" field
        let exemplarsyFacet = [];
        const meta = readHeatmapRowsCustomMeta(info.heatmap);
        if (((_a = info.exemplars) === null || _a === void 0 ? void 0 : _a.length) && meta.yMatchWithLabel) {
            exemplarsXFacet = (_b = info.exemplars) === null || _b === void 0 ? void 0 : _b.fields[0].values;
            // ordinal/labeled heatmap-buckets?
            const hasLabeledY = meta.yOrdinalDisplay != null;
            if (hasLabeledY) {
                let matchExemplarsBy = (_c = info.exemplars) === null || _c === void 0 ? void 0 : _c.fields.find((field) => field.name === meta.yMatchWithLabel).values;
                exemplarsyFacet = matchExemplarsBy.map((label) => { var _a; return (_a = meta.yOrdinalLabel) === null || _a === void 0 ? void 0 : _a.indexOf(label); });
            }
            else {
                exemplarsyFacet = (_d = info.exemplars) === null || _d === void 0 ? void 0 : _d.fields[1].values; // "Value" field
            }
        }
        return [null, (_e = info.heatmap) === null || _e === void 0 ? void 0 : _e.fields.map((f) => f.values), [exemplarsXFacet, exemplarsyFacet]];
    }, [info.heatmap, info.exemplars]);
    const [hover, setHover] = useState(undefined);
    const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState(false);
    const isToolTipOpen = useRef(false);
    const onCloseToolTip = () => {
        isToolTipOpen.current = false;
        setShouldDisplayCloseButton(false);
        onhover(null);
    };
    const onclick = () => {
        isToolTipOpen.current = !isToolTipOpen.current;
        // Linking into useState required to re-render tooltip
        setShouldDisplayCloseButton(isToolTipOpen.current);
    };
    const onhover = useCallback((evt) => {
        setHover(evt !== null && evt !== void 0 ? evt : undefined);
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]);
    // ugh
    const dataRef = useRef(info);
    dataRef.current = info;
    const builder = useMemo(() => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const scaleConfig = (_d = (_c = (_b = (_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmap) === null || _b === void 0 ? void 0 : _b.fields[1].config) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.scaleDistribution;
        return prepConfig({
            dataRef,
            theme,
            eventBus,
            onhover: onhover,
            onclick: options.tooltip.show ? onclick : null,
            onzoom: (evt) => {
                const delta = evt.xMax - evt.xMin;
                if (delta > 1) {
                    onChangeTimeRange({ from: evt.xMin, to: evt.xMax });
                }
            },
            isToolTipOpen,
            timeZone,
            getTimeRange: () => timeRangeRef.current,
            sync,
            cellGap: options.cellGap,
            hideLE: (_e = options.filterValues) === null || _e === void 0 ? void 0 : _e.le,
            hideGE: (_f = options.filterValues) === null || _f === void 0 ? void 0 : _f.ge,
            exemplarColor: (_h = (_g = options.exemplars) === null || _g === void 0 ? void 0 : _g.color) !== null && _h !== void 0 ? _h : 'rgba(255,0,255,0.7)',
            yAxisConfig: options.yAxis,
            ySizeDivisor: (scaleConfig === null || scaleConfig === void 0 ? void 0 : scaleConfig.type) === ScaleDistribution.Log ? +(((_k = (_j = options.calculation) === null || _j === void 0 ? void 0 : _j.yBuckets) === null || _k === void 0 ? void 0 : _k.value) || 1) : 1,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options, timeZone, data.structureRev]);
    const renderLegend = () => {
        var _a, _b, _c, _d, _e, _f;
        if (!info.heatmap || !options.legend.show) {
            return null;
        }
        let heatmapType = (_c = (_b = (_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmap) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.type;
        let isSparseHeatmap = heatmapType === DataFrameType.HeatmapCells && !isHeatmapCellsDense((_d = dataRef.current) === null || _d === void 0 ? void 0 : _d.heatmap);
        let countFieldIdx = !isSparseHeatmap ? 2 : 3;
        const countField = info.heatmap.fields[countFieldIdx];
        let hoverValue = undefined;
        // seriesIdx: 1 is heatmap layer; 2 is exemplar layer
        if (hover && info.heatmap.fields && hover.seriesIdx === 1) {
            hoverValue = countField.values[hover.dataIdx];
        }
        return (React.createElement(VizLayout.Legend, { placement: "bottom", maxHeight: "20%" },
            React.createElement("div", { className: styles.colorScaleWrapper },
                React.createElement(ColorScale, { hoverValue: hoverValue, colorPalette: palette, min: (_e = dataRef.current.heatmapColors) === null || _e === void 0 ? void 0 : _e.minValue, max: (_f = dataRef.current.heatmapColors) === null || _f === void 0 ? void 0 : _f.maxValue, display: info.display }))));
    };
    if (info.warning || !info.heatmap) {
        return (React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data, needsNumberField: true, message: info.warning }));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(VizLayout, { width: width, height: height, legend: renderLegend() }, (vizWidth, vizHeight) => (React.createElement(UPlotChart, { config: builder, data: facets, width: vizWidth, height: vizHeight }))),
        React.createElement(Portal, null, hover && options.tooltip.show && (React.createElement(VizTooltipContainer, { position: { x: hover.pageX, y: hover.pageY }, offset: { x: 10, y: 10 }, allowPointerEvents: isToolTipOpen.current },
            shouldDisplayCloseButton && React.createElement(ExemplarModalHeader, { onClick: onCloseToolTip }),
            React.createElement(HeatmapHoverView, { timeRange: timeRange, data: info, hover: hover, showHistogram: options.tooltip.yHistogram, replaceVars: replaceVariables, scopedVars: scopedVarsFromRawData }))))));
};
const getStyles = (theme) => ({
    colorScaleWrapper: css `
    margin-left: 25px;
    padding: 10px 0;
    max-width: 300px;
  `,
});
//# sourceMappingURL=HeatmapPanel.js.map