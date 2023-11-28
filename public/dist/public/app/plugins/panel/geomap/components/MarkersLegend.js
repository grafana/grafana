import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';
import { formattedValueToString, getFieldColorModeForField } from '@grafana/data';
import { getMinMaxAndDelta } from '@grafana/data/src/field/scale';
import { useStyles2 } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getThresholdItems } from 'app/core/components/TimelineChart/utils';
import { config } from 'app/core/config';
export function MarkersLegend(props) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const { layerName, styleConfig, layer } = props;
    const style = useStyles2(getStyles);
    const hoverEvent = useObservable((_b = (_a = layer === null || layer === void 0 ? void 0 : layer.__state) === null || _a === void 0 ? void 0 : _a.mouseEvents) !== null && _b !== void 0 ? _b : of(undefined));
    const colorField = (_d = (_c = styleConfig === null || styleConfig === void 0 ? void 0 : styleConfig.dims) === null || _c === void 0 ? void 0 : _c.color) === null || _d === void 0 ? void 0 : _d.field;
    const hoverValue = useMemo(() => {
        if (!colorField || !hoverEvent) {
            return undefined;
        }
        const props = hoverEvent.getProperties();
        const frame = props.frame;
        if (!frame) {
            return undefined;
        }
        const rowIndex = props.rowIndex;
        return colorField.values[rowIndex];
    }, [hoverEvent, colorField]);
    if (!styleConfig) {
        return React.createElement(React.Fragment, null);
    }
    const { color, opacity } = (_e = styleConfig === null || styleConfig === void 0 ? void 0 : styleConfig.base) !== null && _e !== void 0 ? _e : {};
    const symbol = (_f = styleConfig === null || styleConfig === void 0 ? void 0 : styleConfig.config.symbol) === null || _f === void 0 ? void 0 : _f.fixed;
    if (color && symbol && !colorField) {
        return (React.createElement("div", { className: style.infoWrap },
            React.createElement("div", { className: style.layerName }, layerName),
            React.createElement("div", { className: cx(style.layerBody, style.fixedColorContainer) },
                React.createElement(SanitizedSVG, { src: `public/${symbol}`, className: style.legendSymbol, title: 'Symbol', style: { fill: color, opacity: opacity } }))));
    }
    if (!colorField) {
        return React.createElement(React.Fragment, null);
    }
    const colorMode = getFieldColorModeForField(colorField);
    if (colorMode.isContinuous && colorMode.getColors) {
        const colors = colorMode.getColors(config.theme2);
        const colorRange = getMinMaxAndDelta(colorField);
        // TODO: explore showing mean on the gradiant scale
        // const stats = reduceField({
        //   field: color.field!,
        //   reducers: [
        //     ReducerID.min,
        //     ReducerID.max,
        //     ReducerID.mean,
        //     // std dev?
        //   ]
        // })
        const display = colorField.display
            ? (v) => formattedValueToString(colorField.display(v))
            : (v) => `${v}`;
        return (React.createElement("div", { className: style.infoWrap },
            React.createElement("div", { className: style.layerName }, layerName),
            React.createElement("div", { className: cx(style.layerBody, style.colorScaleWrapper) },
                React.createElement(ColorScale, { hoverValue: hoverValue, colorPalette: colors, min: (_g = colorRange.min) !== null && _g !== void 0 ? _g : 0, max: (_h = colorRange.max) !== null && _h !== void 0 ? _h : 100, display: display, useStopsPercentage: false }))));
    }
    const thresholds = (_j = colorField === null || colorField === void 0 ? void 0 : colorField.config) === null || _j === void 0 ? void 0 : _j.thresholds;
    if (!thresholds || thresholds.steps.length < 2) {
        return React.createElement("div", null); // don't show anything in the legend
    }
    const items = getThresholdItems(colorField.config, config.theme2);
    return (React.createElement("div", { className: style.infoWrap },
        React.createElement("div", { className: style.layerName }, layerName),
        React.createElement("div", { className: cx(style.layerBody, style.legend) }, items.map((item, idx) => (React.createElement("div", { key: `${idx}/${item.label}`, className: style.legendItem },
            React.createElement("i", { style: { background: item.color } }),
            item.label))))));
}
const getStyles = (theme) => ({
    infoWrap: css({
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background.secondary,
        // eslint-disable-next-line @grafana/no-border-radius-literal
        borderRadius: '1px',
        padding: theme.spacing(1),
        borderBottom: `2px solid ${theme.colors.border.strong}`,
        minWidth: '150px',
    }),
    layerName: css({
        fontSize: theme.typography.body.fontSize,
    }),
    layerBody: css({
        paddingLeft: '10px',
    }),
    legend: css({
        lineHeight: '18px',
        display: 'flex',
        flexDirection: 'column',
        fontSize: theme.typography.bodySmall.fontSize,
        padding: '5px 10px 0',
        i: {
            width: '15px',
            height: '15px',
            float: 'left',
            marginRight: '8px',
            opacity: 0.7,
            borderRadius: theme.shape.radius.circle,
        },
    }),
    legendItem: css({
        whiteSpace: 'nowrap',
    }),
    fixedColorContainer: css({
        minWidth: '80px',
        fontSize: theme.typography.bodySmall.fontSize,
        paddingTop: '5px',
    }),
    legendSymbol: css({
        height: '18px',
        width: '18px',
        margin: 'auto',
    }),
    colorScaleWrapper: css({
        minWidth: '200px',
        fontSize: theme.typography.bodySmall.fontSize,
        paddingTop: '10px',
    }),
});
//# sourceMappingURL=MarkersLegend.js.map