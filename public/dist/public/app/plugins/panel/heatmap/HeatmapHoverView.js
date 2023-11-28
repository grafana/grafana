import React, { useEffect, useRef, useState } from 'react';
import { DataFrameType, FieldType, formattedValueToString, getFieldDisplayName, getLinksSupplier, } from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import { LinkButton, VerticalGroup } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { isHeatmapCellsDense, readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';
export const HeatmapHoverView = (props) => {
    if (props.hover.seriesIdx === 2) {
        return React.createElement(DataHoverView, { data: props.data.exemplars, rowIndex: props.hover.dataIdx, header: 'Exemplar' });
    }
    return React.createElement(HeatmapHoverCell, Object.assign({}, props));
};
const HeatmapHoverCell = ({ data, hover, showHistogram, scopedVars, replaceVars }) => {
    var _a, _b, _c, _d, _e;
    const index = hover.dataIdx;
    const xField = (_a = data.heatmap) === null || _a === void 0 ? void 0 : _a.fields[0];
    const yField = (_b = data.heatmap) === null || _b === void 0 ? void 0 : _b.fields[1];
    const countField = (_c = data.heatmap) === null || _c === void 0 ? void 0 : _c.fields[2];
    const xDisp = (v) => {
        if (xField === null || xField === void 0 ? void 0 : xField.display) {
            return formattedValueToString(xField.display(v));
        }
        if ((xField === null || xField === void 0 ? void 0 : xField.type) === FieldType.time) {
            const tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
            const dashboard = getDashboardSrv().getCurrent();
            return dashboard === null || dashboard === void 0 ? void 0 : dashboard.formatDate(v, tooltipTimeFormat);
        }
        return `${v}`;
    };
    const xVals = xField === null || xField === void 0 ? void 0 : xField.values;
    const yVals = yField === null || yField === void 0 ? void 0 : yField.values;
    const countVals = countField === null || countField === void 0 ? void 0 : countField.values;
    // labeled buckets
    const meta = readHeatmapRowsCustomMeta(data.heatmap);
    const yDisp = (yField === null || yField === void 0 ? void 0 : yField.display) ? (v) => formattedValueToString(yField.display(v)) : (v) => `${v}`;
    const yValueIdx = (_d = index % data.yBucketCount) !== null && _d !== void 0 ? _d : 0;
    let yBucketMin;
    let yBucketMax;
    let nonNumericOrdinalDisplay = undefined;
    if (meta.yOrdinalDisplay) {
        const yMinIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx - 1 : yValueIdx;
        const yMaxIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx : yValueIdx + 1;
        yBucketMin = yMinIdx < 0 ? meta.yMinDisplay : `${meta.yOrdinalDisplay[yMinIdx]}`;
        yBucketMax = `${meta.yOrdinalDisplay[yMaxIdx]}`;
        // e.g. "pod-xyz123"
        if (!meta.yOrdinalLabel || Number.isNaN(+meta.yOrdinalLabel[0])) {
            nonNumericOrdinalDisplay = data.yLayout === HeatmapCellLayout.le ? yBucketMax : yBucketMin;
        }
    }
    else {
        const value = yVals === null || yVals === void 0 ? void 0 : yVals[yValueIdx];
        if (data.yLayout === HeatmapCellLayout.le) {
            yBucketMax = `${value}`;
            if (data.yLog) {
                let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
                let exp = logFn(value) - 1 / data.yLogSplit;
                yBucketMin = `${Math.pow(data.yLog, exp)}`;
            }
            else {
                yBucketMin = `${value - data.yBucketSize}`;
            }
        }
        else {
            yBucketMin = `${value}`;
            if (data.yLog) {
                let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
                let exp = logFn(value) + 1 / data.yLogSplit;
                yBucketMax = `${Math.pow(data.yLog, exp)}`;
            }
            else {
                yBucketMax = `${value + data.yBucketSize}`;
            }
        }
    }
    let xBucketMin;
    let xBucketMax;
    if (data.xLayout === HeatmapCellLayout.le) {
        xBucketMax = xVals === null || xVals === void 0 ? void 0 : xVals[index];
        xBucketMin = xBucketMax - data.xBucketSize;
    }
    else {
        xBucketMin = xVals === null || xVals === void 0 ? void 0 : xVals[index];
        xBucketMax = xBucketMin + data.xBucketSize;
    }
    const count = countVals === null || countVals === void 0 ? void 0 : countVals[index];
    const visibleFields = (_e = data.heatmap) === null || _e === void 0 ? void 0 : _e.fields.filter((f) => { var _a, _b; return !Boolean((_b = (_a = f.config.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) === null || _b === void 0 ? void 0 : _b.tooltip); });
    const links = [];
    const linkLookup = new Set();
    for (const field of visibleFields !== null && visibleFields !== void 0 ? visibleFields : []) {
        const hasLinks = field.config.links && field.config.links.length > 0;
        if (hasLinks && data.heatmap) {
            const appropriateScopedVars = scopedVars.find((scopedVar) => scopedVar && scopedVar.__dataContext && scopedVar.__dataContext.value.field.name === nonNumericOrdinalDisplay);
            field.getLinks = getLinksSupplier(data.heatmap, field, appropriateScopedVars || {}, replaceVars);
        }
        if (field.getLinks) {
            const value = field.values[index];
            const display = field.display ? field.display(value) : { text: `${value}`, numeric: +value };
            field.getLinks({ calculatedValue: display, valueRowIndex: index }).forEach((link) => {
                const key = `${link.title}/${link.href}`;
                if (!linkLookup.has(key)) {
                    links.push(link);
                    linkLookup.add(key);
                }
            });
        }
    }
    let can = useRef(null);
    let histCssWidth = 150;
    let histCssHeight = 50;
    let histCanWidth = Math.round(histCssWidth * devicePixelRatio);
    let histCanHeight = Math.round(histCssHeight * devicePixelRatio);
    useEffect(() => {
        var _a;
        if (showHistogram) {
            let histCtx = (_a = can.current) === null || _a === void 0 ? void 0 : _a.getContext('2d');
            if (histCtx && xVals && yVals && countVals) {
                let fromIdx = index;
                while (xVals[fromIdx--] === xVals[index]) { }
                fromIdx++;
                let toIdx = fromIdx + data.yBucketCount;
                let maxCount = 0;
                let i = fromIdx;
                while (i < toIdx) {
                    let c = countVals[i];
                    maxCount = Math.max(maxCount, c);
                    i++;
                }
                let pHov = new Path2D();
                let pRest = new Path2D();
                i = fromIdx;
                let j = 0;
                while (i < toIdx) {
                    let c = countVals[i];
                    if (c > 0) {
                        let pctY = c / maxCount;
                        let pctX = j / (data.yBucketCount + 1);
                        let p = i === index ? pHov : pRest;
                        p.rect(Math.round(histCanWidth * pctX), Math.round(histCanHeight * (1 - pctY)), Math.round(histCanWidth / data.yBucketCount), Math.round(histCanHeight * pctY));
                    }
                    i++;
                    j++;
                }
                histCtx.clearRect(0, 0, histCanWidth, histCanHeight);
                histCtx.fillStyle = '#ffffff80';
                histCtx.fill(pRest);
                histCtx.fillStyle = '#ff000080';
                histCtx.fill(pHov);
            }
        }
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]);
    const [isSparse] = useState(() => { var _a, _b; return ((_b = (_a = data.heatmap) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.type) === DataFrameType.HeatmapCells && !isHeatmapCellsDense(data.heatmap); });
    if (isSparse) {
        return (React.createElement("div", null,
            React.createElement(DataHoverView, { data: data.heatmap, rowIndex: index })));
    }
    const renderYBucket = () => {
        if (nonNumericOrdinalDisplay) {
            return React.createElement("div", null,
                "Name: ",
                nonNumericOrdinalDisplay);
        }
        switch (data.yLayout) {
            case HeatmapCellLayout.unknown:
                return React.createElement("div", null, yDisp(yBucketMin));
        }
        return (React.createElement("div", null,
            "Bucket: ",
            yDisp(yBucketMin),
            " - ",
            yDisp(yBucketMax)));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", null, xDisp(xBucketMin)),
            data.xLayout !== HeatmapCellLayout.unknown && React.createElement("div", null, xDisp(xBucketMax))),
        showHistogram && (React.createElement("canvas", { width: histCanWidth, height: histCanHeight, ref: can, style: { width: histCanWidth + 'px', height: histCanHeight + 'px' } })),
        React.createElement("div", null,
            renderYBucket(),
            React.createElement("div", null,
                getFieldDisplayName(countField, data.heatmap),
                ": ",
                data.display(count))),
        links.length > 0 && (React.createElement(VerticalGroup, null, links.map((link, i) => (React.createElement(LinkButton, { key: i, icon: 'external-link-alt', target: link.target, href: link.href, onClick: link.onClick, fill: "text", style: { width: '100%' } }, link.title)))))));
};
//# sourceMappingURL=HeatmapHoverView.js.map