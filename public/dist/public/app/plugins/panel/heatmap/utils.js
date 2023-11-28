import uPlot from 'uplot';
import { DashboardCursorSync, DataFrameType, DataHoverClearEvent, DataHoverEvent, formattedValueToString, getValueFormat, incrRoundDn, incrRoundUp, FieldType, } from '@grafana/data';
import { AxisPlacement, ScaleDirection, ScaleDistribution, ScaleOrientation, HeatmapCellLayout } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { pointWithin, Quadtree } from '../barchart/quadtree';
export function prepConfig(opts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _z, _0, _1, _2;
    const { dataRef, theme, eventBus, onhover, onclick, onzoom, isToolTipOpen, timeZone, getTimeRange, cellGap, hideLE, hideGE, yAxisConfig, ySizeDivisor, sync, eventsScope = '__global_', } = opts;
    const xScaleKey = 'x';
    let xScaleUnit = 'time';
    let isTime = true;
    if (((_b = (_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmap) === null || _b === void 0 ? void 0 : _b.fields[0].type) !== FieldType.time) {
        xScaleUnit = (_f = (_e = (_d = (_c = dataRef.current) === null || _c === void 0 ? void 0 : _c.heatmap) === null || _d === void 0 ? void 0 : _d.fields[0].config) === null || _e === void 0 ? void 0 : _e.unit) !== null && _f !== void 0 ? _f : 'x';
        isTime = false;
    }
    const pxRatio = devicePixelRatio;
    let heatmapType = (_j = (_h = (_g = dataRef.current) === null || _g === void 0 ? void 0 : _g.heatmap) === null || _h === void 0 ? void 0 : _h.meta) === null || _j === void 0 ? void 0 : _j.type;
    const exemplarFillColor = theme.visualization.getColorByName(opts.exemplarColor);
    let qt;
    let hRect;
    let builder = new UPlotConfigBuilder(timeZone);
    let rect;
    builder.addHook('init', (u) => {
        u.root.querySelectorAll('.u-cursor-pt').forEach((el) => {
            Object.assign(el.style, {
                borderRadius: '0',
                border: '1px solid white',
                background: 'transparent',
            });
        });
        onclick &&
            u.over.addEventListener('mouseup', (e) => {
                // @ts-ignore
                let isDragging = u.cursor.drag._x || u.cursor.drag._y;
                if (!isDragging) {
                    onclick(e);
                }
            }, true);
    });
    onzoom &&
        builder.addHook('setSelect', (u) => {
            onzoom({
                xMin: u.posToVal(u.select.left, xScaleKey),
                xMax: u.posToVal(u.select.left + u.select.width, xScaleKey),
            });
            u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
        });
    if (isTime) {
        // this is a tmp hack because in mode: 2, uplot does not currently call scales.x.range() for setData() calls
        // scales.x.range() typically reads back from drilled-down panelProps.timeRange via getTimeRange()
        builder.addHook('setData', (u) => {
            //let [min, max] = (u.scales!.x!.range! as uPlot.Range.Function)(u, 0, 100, xScaleKey);
            let { min: xMin, max: xMax } = u.scales.x;
            let min = getTimeRange().from.valueOf();
            let max = getTimeRange().to.valueOf();
            if (xMin !== min || xMax !== max) {
                queueMicrotask(() => {
                    u.setScale(xScaleKey, { min, max });
                });
            }
        });
    }
    // rect of .u-over (grid area)
    builder.addHook('syncRect', (u, r) => {
        rect = r;
    });
    const payload = {
        point: {
            [xScaleUnit]: null,
        },
        data: (_k = dataRef.current) === null || _k === void 0 ? void 0 : _k.heatmap,
    };
    const hoverEvent = new DataHoverEvent(payload);
    let pendingOnleave;
    onhover &&
        builder.addHook('setLegend', (u) => {
            if (u.cursor.idxs != null) {
                for (let i = 0; i < u.cursor.idxs.length; i++) {
                    const sel = u.cursor.idxs[i];
                    if (sel != null) {
                        const { left, top } = u.cursor;
                        payload.rowIndex = sel;
                        payload.point[xScaleUnit] = u.posToVal(left, xScaleKey);
                        eventBus.publish(hoverEvent);
                        if (!isToolTipOpen.current) {
                            if (pendingOnleave) {
                                clearTimeout(pendingOnleave);
                                pendingOnleave = 0;
                            }
                            onhover({
                                seriesIdx: i,
                                dataIdx: sel,
                                pageX: rect.left + left,
                                pageY: rect.top + top,
                            });
                        }
                        return;
                    }
                }
            }
            if (!isToolTipOpen.current) {
                // if tiles have gaps, reduce flashing / re-render (debounce onleave by 100ms)
                if (!pendingOnleave) {
                    pendingOnleave = setTimeout(() => {
                        onhover(null);
                        payload.rowIndex = undefined;
                        payload.point[xScaleUnit] = null;
                        eventBus.publish(hoverEvent);
                    }, 100);
                }
            }
        });
    builder.addHook('drawClear', (u) => {
        qt = qt || new Quadtree(0, 0, u.bbox.width, u.bbox.height);
        qt.clear();
        // force-clear the path cache to cause drawBars() to rebuild new quadtree
        u.series.forEach((s, i) => {
            if (i > 0) {
                // @ts-ignore
                s._paths = null;
            }
        });
    });
    builder.setMode(2);
    builder.addScale({
        scaleKey: xScaleKey,
        isTime,
        orientation: ScaleOrientation.Horizontal,
        direction: ScaleDirection.Right,
        // TODO: expand by x bucket size and layout
        range: (u, dataMin, dataMax) => {
            var _a, _b, _c, _d, _e;
            if (isTime) {
                return [getTimeRange().from.valueOf(), getTimeRange().to.valueOf()];
            }
            else {
                if (((_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.xLayout) === HeatmapCellLayout.le) {
                    return [dataMin - ((_b = dataRef.current) === null || _b === void 0 ? void 0 : _b.xBucketSize), dataMax];
                }
                else if (((_c = dataRef.current) === null || _c === void 0 ? void 0 : _c.xLayout) === HeatmapCellLayout.ge) {
                    return [dataMin, dataMax + ((_d = dataRef.current) === null || _d === void 0 ? void 0 : _d.xBucketSize)];
                }
                else {
                    let offset = ((_e = dataRef.current) === null || _e === void 0 ? void 0 : _e.xBucketSize) / 2;
                    return [dataMin - offset, dataMax + offset];
                }
            }
        },
    });
    let incrs;
    if (!isTime) {
        incrs = [];
        for (let i = 0; i < 10; i++) {
            incrs.push(i * ((_l = dataRef.current) === null || _l === void 0 ? void 0 : _l.xBucketSize));
        }
    }
    builder.addAxis({
        scaleKey: xScaleKey,
        placement: AxisPlacement.Bottom,
        incrs,
        isTime,
        theme: theme,
        timeZone,
    });
    const yField = (_o = (_m = dataRef.current) === null || _m === void 0 ? void 0 : _m.heatmap) === null || _o === void 0 ? void 0 : _o.fields[1];
    if (!yField) {
        return builder; // early abort (avoids error)
    }
    const yFieldConfig = (_p = yField.config) === null || _p === void 0 ? void 0 : _p.custom;
    const yScale = (_q = yFieldConfig === null || yFieldConfig === void 0 ? void 0 : yFieldConfig.scaleDistribution) !== null && _q !== void 0 ? _q : { type: ScaleDistribution.Linear };
    const yAxisReverse = Boolean(yAxisConfig.reverse);
    const isSparseHeatmap = heatmapType === DataFrameType.HeatmapCells && !isHeatmapCellsDense((_r = dataRef.current) === null || _r === void 0 ? void 0 : _r.heatmap);
    const shouldUseLogScale = yScale.type !== ScaleDistribution.Linear || isSparseHeatmap;
    const isOrdinalY = readHeatmapRowsCustomMeta((_s = dataRef.current) === null || _s === void 0 ? void 0 : _s.heatmap).yOrdinalDisplay != null;
    // random to prevent syncing y in other heatmaps
    // TODO: try to match TimeSeries y keygen algo to sync with TimeSeries panels (when not isOrdinalY)
    const yScaleKey = 'y_' + (Math.random() + 1).toString(36).substring(7);
    builder.addScale({
        scaleKey: yScaleKey,
        isTime: false,
        // distribution: ScaleDistribution.Ordinal, // does not work with facets/scatter yet
        orientation: ScaleOrientation.Vertical,
        direction: yAxisReverse ? ScaleDirection.Down : ScaleDirection.Up,
        // should be tweakable manually
        distribution: shouldUseLogScale ? ScaleDistribution.Log : ScaleDistribution.Linear,
        log: (_t = yScale.log) !== null && _t !== void 0 ? _t : 2,
        range: 
        // sparse already accounts for le/ge by explicit yMin & yMax cell bounds, so no need to expand y range
        isSparseHeatmap
            ? (u, dataMin, dataMax) => {
                var _a;
                let scaleMin, scaleMax;
                [scaleMin, scaleMax] = shouldUseLogScale
                    ? uPlot.rangeLog(dataMin, dataMax, ((_a = yScale.log) !== null && _a !== void 0 ? _a : 2), true)
                    : [dataMin, dataMax];
                if (shouldUseLogScale && !isOrdinalY) {
                    let yExp = u.scales[yScaleKey].log;
                    let log = yExp === 2 ? Math.log2 : Math.log10;
                    let { min: explicitMin, max: explicitMax } = yAxisConfig;
                    // guard against <= 0
                    if (explicitMin != null && explicitMin > 0) {
                        // snap to magnitude
                        let minLog = log(explicitMin);
                        scaleMin = Math.pow(yExp, incrRoundDn(minLog, 1));
                    }
                    if (explicitMax != null && explicitMax > 0) {
                        let maxLog = log(explicitMax);
                        scaleMax = Math.pow(yExp, incrRoundUp(maxLog, 1));
                    }
                }
                return [scaleMin, scaleMax];
            }
            : // dense and ordinal only have one of yMin|yMax|y, so expand range by one cell in the direction of le/ge/unknown
                (u, dataMin, dataMax) => {
                    var _a, _b, _c, _d, _e;
                    let scaleMin = dataMin, scaleMax = dataMax;
                    let { min: explicitMin, max: explicitMax } = yAxisConfig;
                    // logarithmic expansion
                    if (shouldUseLogScale) {
                        let yExp = u.scales[yScaleKey].log;
                        let minExpanded = false;
                        let maxExpanded = false;
                        let log = yExp === 2 ? Math.log2 : Math.log10;
                        if (ySizeDivisor !== 1) {
                            let minLog = log(dataMin);
                            let maxLog = log(dataMax);
                            if (!Number.isInteger(minLog)) {
                                scaleMin = Math.pow(yExp, incrRoundDn(minLog, 1));
                                minExpanded = true;
                            }
                            if (!Number.isInteger(maxLog)) {
                                scaleMax = Math.pow(yExp, incrRoundUp(maxLog, 1));
                                maxExpanded = true;
                            }
                        }
                        if (((_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.yLayout) === HeatmapCellLayout.le) {
                            if (!minExpanded) {
                                scaleMin /= yExp;
                            }
                        }
                        else if (((_b = dataRef.current) === null || _b === void 0 ? void 0 : _b.yLayout) === HeatmapCellLayout.ge) {
                            if (!maxExpanded) {
                                scaleMax *= yExp;
                            }
                        }
                        else {
                            scaleMin /= yExp / 2;
                            scaleMax *= yExp / 2;
                        }
                        if (!isOrdinalY) {
                            // guard against <= 0
                            if (explicitMin != null && explicitMin > 0) {
                                // snap down to magnitude
                                let minLog = log(explicitMin);
                                scaleMin = Math.pow(yExp, incrRoundDn(minLog, 1));
                            }
                            if (explicitMax != null && explicitMax > 0) {
                                let maxLog = log(explicitMax);
                                scaleMax = Math.pow(yExp, incrRoundUp(maxLog, 1));
                            }
                        }
                    }
                    // linear expansion
                    else {
                        let bucketSize = (_c = dataRef.current) === null || _c === void 0 ? void 0 : _c.yBucketSize;
                        if (bucketSize === 0) {
                            bucketSize = 1;
                        }
                        if (bucketSize) {
                            if (((_d = dataRef.current) === null || _d === void 0 ? void 0 : _d.yLayout) === HeatmapCellLayout.le) {
                                scaleMin -= bucketSize;
                            }
                            else if (((_e = dataRef.current) === null || _e === void 0 ? void 0 : _e.yLayout) === HeatmapCellLayout.ge) {
                                scaleMax += bucketSize;
                            }
                            else {
                                scaleMin -= bucketSize / 2;
                                scaleMax += bucketSize / 2;
                            }
                        }
                        else {
                            // how to expand scale range if inferred non-regular or log buckets?
                        }
                        if (!isOrdinalY) {
                            scaleMin = explicitMin !== null && explicitMin !== void 0 ? explicitMin : scaleMin;
                            scaleMax = explicitMax !== null && explicitMax !== void 0 ? explicitMax : scaleMax;
                        }
                    }
                    return [scaleMin, scaleMax];
                },
    });
    const dispY = (_u = yField.display) !== null && _u !== void 0 ? _u : getValueFormat('short');
    builder.addAxis({
        scaleKey: yScaleKey,
        show: yAxisConfig.axisPlacement !== AxisPlacement.Hidden,
        placement: yAxisConfig.axisPlacement || AxisPlacement.Left,
        size: yAxisConfig.axisWidth || null,
        label: yAxisConfig.axisLabel,
        theme: theme,
        formatValue: (v, decimals) => formattedValueToString(dispY(v, decimals)),
        splits: isOrdinalY
            ? (self) => {
                var _a, _b;
                const meta = readHeatmapRowsCustomMeta((_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmap);
                if (!meta.yOrdinalDisplay) {
                    return [0, 1]; //?
                }
                let splits = meta.yOrdinalDisplay.map((v, idx) => idx);
                switch ((_b = dataRef.current) === null || _b === void 0 ? void 0 : _b.yLayout) {
                    case HeatmapCellLayout.le:
                        splits.unshift(-1);
                        break;
                    case HeatmapCellLayout.ge:
                        splits.push(splits.length);
                        break;
                }
                // Skip labels when the height is too small
                if (self.height < 60) {
                    splits = [splits[0], splits[splits.length - 1]];
                }
                else {
                    while (splits.length > 3 && (self.height - 15) / splits.length < 10) {
                        splits = splits.filter((v, idx) => idx % 2 === 0); // remove half the items
                    }
                }
                return splits;
            }
            : undefined,
        values: isOrdinalY
            ? (self, splits) => {
                var _a;
                const meta = readHeatmapRowsCustomMeta((_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmap);
                if (meta.yOrdinalDisplay) {
                    return splits.map((v) => {
                        var _a, _b;
                        return v < 0
                            ? (_a = meta.yMinDisplay) !== null && _a !== void 0 ? _a : '' // Check prometheus style labels
                            : (_b = meta.yOrdinalDisplay[v]) !== null && _b !== void 0 ? _b : '';
                    });
                }
                return splits;
            }
            : undefined,
    });
    const pathBuilder = isSparseHeatmap ? heatmapPathsSparse : heatmapPathsDense;
    // heatmap layer
    builder.addSeries({
        facets: [
            {
                scale: xScaleKey,
                auto: true,
                sorted: 1,
            },
            {
                scale: yScaleKey,
                auto: true,
            },
        ],
        pathBuilder: pathBuilder({
            each: (u, seriesIdx, dataIdx, x, y, xSize, ySize) => {
                qt.add({
                    x: x - u.bbox.left,
                    y: y - u.bbox.top,
                    w: xSize,
                    h: ySize,
                    sidx: seriesIdx,
                    didx: dataIdx,
                });
            },
            gap: cellGap,
            hideLE,
            hideGE,
            xAlign: ((_v = dataRef.current) === null || _v === void 0 ? void 0 : _v.xLayout) === HeatmapCellLayout.le
                ? -1
                : ((_w = dataRef.current) === null || _w === void 0 ? void 0 : _w.xLayout) === HeatmapCellLayout.ge
                    ? 1
                    : 0,
            yAlign: ((((_z = dataRef.current) === null || _z === void 0 ? void 0 : _z.yLayout) === HeatmapCellLayout.le
                ? -1
                : ((_0 = dataRef.current) === null || _0 === void 0 ? void 0 : _0.yLayout) === HeatmapCellLayout.ge
                    ? 1
                    : 0) * (yAxisReverse ? -1 : 1)),
            ySizeDivisor,
            disp: {
                fill: {
                    values: (u, seriesIdx) => { var _a, _b; return (_b = (_a = dataRef.current) === null || _a === void 0 ? void 0 : _a.heatmapColors) === null || _b === void 0 ? void 0 : _b.values; },
                    index: (_2 = (_1 = dataRef.current) === null || _1 === void 0 ? void 0 : _1.heatmapColors) === null || _2 === void 0 ? void 0 : _2.palette,
                },
            },
        }),
        theme,
        scaleKey: '', // facets' scales used (above)
    });
    // exemplars layer
    builder.addSeries({
        facets: [
            {
                scale: xScaleKey,
                auto: true,
                sorted: 1,
            },
            {
                scale: yScaleKey,
                auto: true,
            },
        ],
        pathBuilder: heatmapPathsPoints({
            each: (u, seriesIdx, dataIdx, x, y, xSize, ySize) => {
                qt.add({
                    x: x - u.bbox.left,
                    y: y - u.bbox.top,
                    w: xSize,
                    h: ySize,
                    sidx: seriesIdx,
                    didx: dataIdx,
                });
            },
        }, exemplarFillColor),
        theme,
        scaleKey: '', // facets' scales used (above)
    });
    const cursor = {
        drag: {
            x: true,
            y: false,
            setScale: false,
        },
        dataIdx: (u, seriesIdx) => {
            if (seriesIdx === 1) {
                hRect = null;
                let cx = u.cursor.left * pxRatio;
                let cy = u.cursor.top * pxRatio;
                qt.get(cx, cy, 1, 1, (o) => {
                    if (pointWithin(cx, cy, o.x, o.y, o.x + o.w, o.y + o.h)) {
                        hRect = o;
                    }
                });
            }
            return hRect && seriesIdx === hRect.sidx ? hRect.didx : null;
        },
        points: {
            fill: 'rgba(255,255,255, 0.3)',
            bbox: (u, seriesIdx) => {
                let isHovered = hRect && seriesIdx === hRect.sidx;
                return {
                    left: isHovered ? hRect.x / pxRatio : -10,
                    top: isHovered ? hRect.y / pxRatio : -10,
                    width: isHovered ? hRect.w / pxRatio : 0,
                    height: isHovered ? hRect.h / pxRatio : 0,
                };
            },
        },
    };
    if (sync && sync() !== DashboardCursorSync.Off) {
        cursor.sync = {
            key: eventsScope,
            scales: [xScaleKey, yScaleKey],
            filters: {
                pub: (type, src, x, y, w, h, dataIdx) => {
                    if (x < 0) {
                        payload.point[xScaleUnit] = null;
                        eventBus.publish(new DataHoverClearEvent());
                    }
                    else {
                        payload.point[xScaleUnit] = src.posToVal(x, xScaleKey);
                        eventBus.publish(hoverEvent);
                    }
                    return true;
                },
            },
        };
        builder.setSync();
    }
    builder.setCursor(cursor);
    return builder;
}
const CRISP_EDGES_GAP_MIN = 4;
export function heatmapPathsDense(opts) {
    const { disp, each, gap = 1, hideLE = -Infinity, hideGE = Infinity, xAlign = 1, yAlign = 1, ySizeDivisor = 1 } = opts;
    const pxRatio = devicePixelRatio;
    const round = gap >= CRISP_EDGES_GAP_MIN ? Math.round : (v) => v;
    const cellGap = Math.round(gap * pxRatio);
    return (u, seriesIdx) => {
        uPlot.orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc) => {
            var _a;
            let d = u.data[seriesIdx];
            const xs = d[0];
            const ys = d[1];
            const counts = d[2];
            const dlen = xs.length;
            // fill colors are mapped from interpolating densities / counts along some gradient
            // (should be quantized to 64 colors/levels max. e.g. 16)
            let fills = disp.fill.values(u, seriesIdx);
            let fillPalette = (_a = disp.fill.index) !== null && _a !== void 0 ? _a : [...new Set(fills)];
            let fillPaths = fillPalette.map((color) => new Path2D());
            // detect x and y bin qtys by detecting layout repetition in x & y data
            let yBinQty = dlen - ys.lastIndexOf(ys[0]);
            let xBinQty = dlen / yBinQty;
            let yBinIncr = ys[1] - ys[0] || scaleY.max - scaleY.min;
            let xBinIncr = xs[yBinQty] - xs[0];
            // uniform tile sizes based on zoom level
            let xSize;
            let ySize;
            if (scaleX.distr === 3) {
                xSize = Math.abs(valToPosX(xs[0] * scaleX.log, scaleX, xDim, xOff) - valToPosX(xs[0], scaleX, xDim, xOff));
            }
            else {
                xSize = Math.abs(valToPosX(xBinIncr, scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff));
            }
            if (scaleY.distr === 3) {
                ySize =
                    Math.abs(valToPosY(ys[0] * scaleY.log, scaleY, yDim, yOff) - valToPosY(ys[0], scaleY, yDim, yOff)) /
                        ySizeDivisor;
            }
            else {
                ySize = Math.abs(valToPosY(yBinIncr, scaleY, yDim, yOff) - valToPosY(0, scaleY, yDim, yOff)) / ySizeDivisor;
            }
            // clamp min tile size to 1px
            xSize = Math.max(1, round(xSize - cellGap));
            ySize = Math.max(1, round(ySize - cellGap));
            // bucket agg direction
            // let xCeil = false;
            // let yCeil = false;
            let xOffset = xAlign === -1 ? -xSize : xAlign === 0 ? -xSize / 2 : 0;
            let yOffset = yAlign === 1 ? -ySize : yAlign === 0 ? -ySize / 2 : 0;
            // pre-compute x and y offsets
            let cys = ys.slice(0, yBinQty).map((y) => round(valToPosY(y, scaleY, yDim, yOff) + yOffset));
            let cxs = Array.from({ length: xBinQty }, (v, i) => round(valToPosX(xs[i * yBinQty], scaleX, xDim, xOff) + xOffset));
            for (let i = 0; i < dlen; i++) {
                if (counts[i] > hideLE && counts[i] < hideGE) {
                    let cx = cxs[~~(i / yBinQty)];
                    let cy = cys[i % yBinQty];
                    let fillPath = fillPaths[fills[i]];
                    rect(fillPath, cx, cy, xSize, ySize);
                    each(u, 1, i, cx, cy, xSize, ySize);
                }
            }
            u.ctx.save();
            //	u.ctx.globalAlpha = 0.8;
            u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.clip();
            fillPaths.forEach((p, i) => {
                u.ctx.fillStyle = fillPalette[i];
                u.ctx.fill(p);
            });
            u.ctx.restore();
            return null;
        });
        return null;
    };
}
export function heatmapPathsPoints(opts, exemplarColor) {
    return (u, seriesIdx) => {
        uPlot.orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc) => {
            //console.time('heatmapPathsSparse');
            let points = new Path2D();
            let fillPaths = [points];
            let fillPalette = [exemplarColor !== null && exemplarColor !== void 0 ? exemplarColor : 'rgba(255,0,255,0.7)'];
            for (let i = 0; i < dataX.length; i++) {
                let yVal = dataY[i];
                yVal -= 0.5; // center vertically in bucket (when tiles are le)
                // y-randomize vertically to distribute exemplars in same bucket at same time
                let randSign = Math.round(Math.random()) * 2 - 1;
                yVal += randSign * 0.5 * Math.random();
                let x = valToPosX(dataX[i], scaleX, xDim, xOff);
                let y = valToPosY(yVal, scaleY, yDim, yOff);
                let w = 8;
                let h = 8;
                rect(points, x - w / 2, y - h / 2, w, h);
                opts.each(u, seriesIdx, i, x - w / 2, y - h / 2, w, h);
            }
            u.ctx.save();
            u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.clip();
            fillPaths.forEach((p, i) => {
                u.ctx.fillStyle = fillPalette[i];
                u.ctx.fill(p);
            });
            u.ctx.restore();
        });
        return null;
    };
}
// accepts xMax, yMin, yMax, count
// xbinsize? x tile sizes are uniform?
export function heatmapPathsSparse(opts) {
    const { disp, each, gap = 1, hideLE = -Infinity, hideGE = Infinity } = opts;
    const pxRatio = devicePixelRatio;
    const round = gap >= CRISP_EDGES_GAP_MIN ? Math.round : (v) => v;
    const cellGap = Math.round(gap * pxRatio);
    return (u, seriesIdx) => {
        uPlot.orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc) => {
            //console.time('heatmapPathsSparse');
            var _a;
            let d = u.data[seriesIdx];
            const xMaxs = d[0]; // xMax, do we get interval?
            const yMins = d[1];
            const yMaxs = d[2];
            const counts = d[3];
            const dlen = xMaxs.length;
            // fill colors are mapped from interpolating densities / counts along some gradient
            // (should be quantized to 64 colors/levels max. e.g. 16)
            let fills = disp.fill.values(u, seriesIdx);
            let fillPalette = (_a = disp.fill.index) !== null && _a !== void 0 ? _a : [...new Set(fills)];
            let fillPaths = fillPalette.map((color) => new Path2D());
            // cache all tile bounds
            let xOffs = new Map();
            let yOffs = new Map();
            for (let i = 0; i < xMaxs.length; i++) {
                let xMax = xMaxs[i];
                let yMin = yMins[i];
                let yMax = yMaxs[i];
                if (!xOffs.has(xMax)) {
                    xOffs.set(xMax, round(valToPosX(xMax, scaleX, xDim, xOff)));
                }
                if (!yOffs.has(yMin)) {
                    yOffs.set(yMin, round(valToPosY(yMin, scaleY, yDim, yOff)));
                }
                if (!yOffs.has(yMax)) {
                    yOffs.set(yMax, round(valToPosY(yMax, scaleY, yDim, yOff)));
                }
            }
            // uniform x size (interval, step)
            let xSizeUniform = xOffs.get(xMaxs.find((v) => v !== xMaxs[0])) - xOffs.get(xMaxs[0]);
            for (let i = 0; i < dlen; i++) {
                if (counts[i] <= hideLE || counts[i] >= hideGE) {
                    continue;
                }
                let xMax = xMaxs[i];
                let yMin = yMins[i];
                let yMax = yMaxs[i];
                let xMaxPx = xOffs.get(xMax); // xSize is from interval, or inferred delta?
                let yMinPx = yOffs.get(yMin);
                let yMaxPx = yOffs.get(yMax);
                let xSize = xSizeUniform;
                let ySize = yMinPx - yMaxPx;
                // clamp min tile size to 1px
                xSize = Math.max(1, xSize - cellGap);
                ySize = Math.max(1, ySize - cellGap);
                let x = xMaxPx;
                let y = yMinPx;
                let fillPath = fillPaths[fills[i]];
                rect(fillPath, x, y, xSize, ySize);
                each(u, 1, i, x, y, xSize, ySize);
            }
            u.ctx.save();
            //	u.ctx.globalAlpha = 0.8;
            u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.clip();
            fillPaths.forEach((p, i) => {
                u.ctx.fillStyle = fillPalette[i];
                u.ctx.fill(p);
            });
            u.ctx.restore();
            //console.timeEnd('heatmapPathsSparse');
        });
        return null;
    };
}
export const boundedMinMax = (values, minValue, maxValue, hideLE = -Infinity, hideGE = Infinity) => {
    if (minValue == null) {
        minValue = Infinity;
        for (let i = 0; i < values.length; i++) {
            if (values[i] > hideLE && values[i] < hideGE) {
                minValue = Math.min(minValue, values[i]);
            }
        }
    }
    if (maxValue == null) {
        maxValue = -Infinity;
        for (let i = 0; i < values.length; i++) {
            if (values[i] > hideLE && values[i] < hideGE) {
                maxValue = Math.max(maxValue, values[i]);
            }
        }
    }
    return [minValue, maxValue];
};
export const valuesToFills = (values, palette, minValue, maxValue) => {
    let range = maxValue - minValue || 1;
    let paletteSize = palette.length;
    let indexedFills = Array(values.length);
    for (let i = 0; i < values.length; i++) {
        indexedFills[i] =
            values[i] < minValue
                ? 0
                : values[i] > maxValue
                    ? paletteSize - 1
                    : Math.min(paletteSize - 1, Math.floor((paletteSize * (values[i] - minValue)) / range));
    }
    return indexedFills;
};
//# sourceMappingURL=utils.js.map