import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePrevious } from 'react-use';
import { fieldReducers, reduceField, ReducerID, getDisplayProcessor, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Portal, TooltipDisplayMode, UPlotChart, VizLayout, VizLegend, VizTooltipContainer, } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { TooltipView } from './TooltipView';
import { SeriesMapping } from './panelcfg.gen';
import { prepData, prepScatter } from './scatter';
const TOOLTIP_OFFSET = 10;
export const XYChartPanel2 = (props) => {
    const [error, setError] = useState();
    const [series, setSeries] = useState([]);
    const [builder, setBuilder] = useState();
    const [facets, setFacets] = useState();
    const [hover, setHover] = useState();
    const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState(false);
    const isToolTipOpen = useRef(false);
    const oldOptions = usePrevious(props.options);
    const oldData = usePrevious(props.data);
    const onCloseToolTip = () => {
        isToolTipOpen.current = false;
        setShouldDisplayCloseButton(false);
        scatterHoverCallback(undefined);
    };
    const onUPlotClick = () => {
        isToolTipOpen.current = !isToolTipOpen.current;
        // Linking into useState required to re-render tooltip
        setShouldDisplayCloseButton(isToolTipOpen.current);
    };
    const scatterHoverCallback = (hover) => {
        setHover(hover);
    };
    const initSeries = useCallback(() => {
        const getData = () => props.data.series;
        const info = prepScatter(props.options, getData, config.theme2, scatterHoverCallback, onUPlotClick, isToolTipOpen);
        if (info.error) {
            setError(info.error);
        }
        else if (info.series.length && props.data.series) {
            setBuilder(info.builder);
            setSeries(info.series);
            setFacets(() => prepData(info, props.data.series));
            setError(undefined);
        }
    }, [props.data.series, props.options]);
    const initFacets = useCallback(() => {
        setFacets(() => prepData({ error, series }, props.data.series));
    }, [props.data.series, error, series]);
    useEffect(() => {
        if (oldOptions !== props.options || (oldData === null || oldData === void 0 ? void 0 : oldData.structureRev) !== props.data.structureRev) {
            initSeries();
        }
        else if ((oldData === null || oldData === void 0 ? void 0 : oldData.series) !== props.data.series) {
            initFacets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props]);
    const renderLegend = () => {
        var _a, _b, _c, _d;
        const items = [];
        const defaultFormatter = (v) => (v == null ? '-' : v.toFixed(1));
        const theme = config.theme2;
        for (let si = 0; si < series.length; si++) {
            const s = series[si];
            const frame = s.frame(props.data.series);
            if (frame) {
                for (const item of s.legend()) {
                    item.getDisplayValues = () => {
                        var _a;
                        const calcs = props.options.legend.calcs;
                        if (!(calcs === null || calcs === void 0 ? void 0 : calcs.length)) {
                            return [];
                        }
                        const field = s.y(frame);
                        const fmt = (_a = field.display) !== null && _a !== void 0 ? _a : defaultFormatter;
                        let countFormatter = null;
                        const fieldCalcs = reduceField({
                            field,
                            reducers: calcs,
                        });
                        return calcs.map((reducerId) => {
                            const fieldReducer = fieldReducers.get(reducerId);
                            let formatter = fmt;
                            if (fieldReducer.id === ReducerID.diffperc) {
                                formatter = getDisplayProcessor({
                                    field: Object.assign(Object.assign({}, field), { config: Object.assign(Object.assign({}, field.config), { unit: 'percent' }) }),
                                    theme,
                                });
                            }
                            if (fieldReducer.id === ReducerID.count ||
                                fieldReducer.id === ReducerID.changeCount ||
                                fieldReducer.id === ReducerID.distinctCount) {
                                if (!countFormatter) {
                                    countFormatter = getDisplayProcessor({
                                        field: Object.assign(Object.assign({}, field), { config: Object.assign(Object.assign({}, field.config), { unit: 'none' }) }),
                                        theme,
                                    });
                                }
                                formatter = countFormatter;
                            }
                            return Object.assign(Object.assign({}, formatter(fieldCalcs[reducerId])), { title: fieldReducer.name, description: fieldReducer.description });
                        });
                    };
                    item.disabled = !((_a = s.show) !== null && _a !== void 0 ? _a : true);
                    if (props.options.seriesMapping === SeriesMapping.Manual) {
                        item.label = (_d = (_c = (_b = props.options.series) === null || _b === void 0 ? void 0 : _b[si]) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : `Series ${si + 1}`;
                    }
                    items.push(item);
                }
            }
        }
        if (!props.options.legend.showLegend) {
            return null;
        }
        const legendStyle = {
            flexStart: css `
        div {
          justify-content: flex-start !important;
        }
      `,
        };
        return (React.createElement(VizLayout.Legend, { placement: props.options.legend.placement, width: props.options.legend.width },
            React.createElement(VizLegend, { className: legendStyle.flexStart, placement: props.options.legend.placement, items: items, displayMode: props.options.legend.displayMode })));
    };
    if (error || !builder || !facets) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, error)));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(VizLayout, { width: props.width, height: props.height, legend: renderLegend() }, (vizWidth, vizHeight) => (React.createElement(UPlotChart, { config: builder, data: facets, width: vizWidth, height: vizHeight }))),
        React.createElement(Portal, null, hover && props.options.tooltip.mode !== TooltipDisplayMode.None && (React.createElement(VizTooltipContainer, { position: { x: hover.pageX, y: hover.pageY }, offset: { x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }, allowPointerEvents: isToolTipOpen.current },
            shouldDisplayCloseButton && (React.createElement("div", { style: {
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                } },
                React.createElement(CloseButton, { onClick: onCloseToolTip, style: {
                        position: 'relative',
                        top: 'auto',
                        right: 'auto',
                        marginRight: 0,
                    } }))),
            React.createElement(TooltipView, { options: props.options.tooltip, allSeries: series, manualSeriesConfigs: props.options.series, seriesMapping: props.options.seriesMapping, rowIndex: hover.xIndex, hoveredPointIndex: hover.scatterIndex, data: props.data.series }))))));
};
//# sourceMappingURL=XYChartPanel2.js.map