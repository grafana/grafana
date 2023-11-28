import { __rest } from "tslib";
import { AxisPlacement, ScaleDistribution, VisibilityMode, HeatmapCellLayout, HeatmapCalculationMode, } from '@grafana/schema';
import { colorSchemes } from './palettes';
import { defaultOptions, HeatmapColorMode } from './types';
/** Called when the version number changes */
export const heatmapMigrationHandler = (panel) => {
    // Migrating from angular
    if (Object.keys(panel.options).length === 0) {
        return heatmapChangedHandler(panel, 'heatmap', { angular: panel }, panel.fieldConfig);
    }
    return panel.options;
};
/**
 * This is called when the panel changes from another panel
 */
export const heatmapChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
    if (prevPluginId === 'heatmap' && prevOptions.angular) {
        const { fieldConfig, options } = angularToReactHeatmap(Object.assign(Object.assign({}, prevOptions.angular), { fieldConfig: prevFieldConfig }));
        panel.fieldConfig = fieldConfig; // Mutates the incoming panel
        return options;
    }
    // alpha for 8.5+, then beta at 9.0.1
    if (prevPluginId === 'heatmap-new') {
        const _a = panel.options, { bucketFrame } = _a, options = __rest(_a, ["bucketFrame"]);
        if (bucketFrame) {
            return Object.assign(Object.assign({}, options), { rowsFrame: bucketFrame });
        }
        return panel.options;
    }
    return {};
};
export function angularToReactHeatmap(angular) {
    var _a, _b, _c, _d, _e, _f;
    const fieldConfig = {
        defaults: {},
        overrides: [],
    };
    const calculate = angular.dataFormat === 'tsbuckets' ? false : true;
    const calculation = Object.assign({}, defaultOptions.calculation);
    const oldYAxis = Object.assign({ logBase: 1 }, angular.yAxis);
    if (calculate) {
        if (angular.xBucketSize) {
            calculation.xBuckets = { mode: HeatmapCalculationMode.Size, value: `${angular.xBucketSize}` };
        }
        else if (angular.xBucketNumber) {
            calculation.xBuckets = { mode: HeatmapCalculationMode.Count, value: `${angular.xBucketNumber}` };
        }
        if (angular.yBucketSize) {
            calculation.yBuckets = { mode: HeatmapCalculationMode.Size, value: `${angular.yBucketSize}` };
        }
        else if (angular.xBucketNumber) {
            calculation.yBuckets = { mode: HeatmapCalculationMode.Count, value: `${angular.yBucketNumber}` };
        }
        if (oldYAxis.logBase > 1) {
            calculation.yBuckets = {
                mode: HeatmapCalculationMode.Count,
                value: +oldYAxis.splitFactor > 0 ? `${oldYAxis.splitFactor}` : undefined,
                scale: {
                    type: ScaleDistribution.Log,
                    log: oldYAxis.logBase,
                },
            };
        }
    }
    const cellGap = asNumber((_a = angular.cards) === null || _a === void 0 ? void 0 : _a.cardPadding, 2);
    const options = {
        calculate,
        calculation,
        color: Object.assign(Object.assign({}, defaultOptions.color), { steps: 128 }),
        cellGap: cellGap ? cellGap : 1,
        cellRadius: asNumber((_b = angular.cards) === null || _b === void 0 ? void 0 : _b.cardRound),
        yAxis: {
            axisPlacement: oldYAxis.show === false ? AxisPlacement.Hidden : AxisPlacement.Left,
            reverse: Boolean(angular.reverseYBuckets),
            axisWidth: asNumber(oldYAxis.width),
            min: oldYAxis.min,
            max: oldYAxis.max,
            unit: oldYAxis.format,
            decimals: oldYAxis.decimals,
        },
        cellValues: {
            decimals: asNumber(angular.tooltipDecimals),
        },
        rowsFrame: {
            layout: getHeatmapCellLayout(angular.yBucketBound),
        },
        legend: {
            show: Boolean((_c = angular.legend) === null || _c === void 0 ? void 0 : _c.show),
        },
        showValue: VisibilityMode.Never,
        tooltip: {
            show: Boolean((_d = angular.tooltip) === null || _d === void 0 ? void 0 : _d.show),
            yHistogram: Boolean((_e = angular.tooltip) === null || _e === void 0 ? void 0 : _e.showHistogram),
        },
        exemplars: Object.assign({}, defaultOptions.exemplars),
    };
    if (angular.hideZeroBuckets) {
        options.filterValues = Object.assign({}, defaultOptions.filterValues); // min: 1e-9
    }
    // Migrate color options
    const color = (_f = angular.color) !== null && _f !== void 0 ? _f : {};
    switch (color === null || color === void 0 ? void 0 : color.mode) {
        case 'spectrum': {
            options.color.mode = HeatmapColorMode.Scheme;
            const current = color.colorScheme;
            let scheme = colorSchemes.find((v) => v.name === current);
            if (!scheme) {
                scheme = colorSchemes.find((v) => current.indexOf(v.name) >= 0);
            }
            options.color.scheme = scheme ? scheme.name : defaultOptions.color.scheme;
            break;
        }
        case 'opacity': {
            options.color.mode = HeatmapColorMode.Opacity;
            options.color.scale = color.scale;
            break;
        }
    }
    options.color.fill = color.cardColor;
    options.color.min = color.min;
    options.color.max = color.max;
    if (typeof color.min === 'number' && typeof color.max === 'number' && color.min > color.max) {
        options.color.min = color.max;
        options.color.max = color.min;
        options.color.reverse = true;
    }
    return { fieldConfig, options };
}
function getHeatmapCellLayout(v) {
    switch (v) {
        case 'upper':
            return HeatmapCellLayout.ge;
        case 'lower':
            return HeatmapCellLayout.le;
        case 'middle':
            return HeatmapCellLayout.unknown;
    }
    return HeatmapCellLayout.auto;
}
function asNumber(v, defaultValue) {
    if (v == null || v === '') {
        return defaultValue;
    }
    const num = +v;
    return isNaN(num) ? defaultValue : num;
}
//# sourceMappingURL=migrations.js.map