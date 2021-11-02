import { FALLBACK_COLOR, FieldColorModeId } from '../types';
import { Registry } from '../utils/Registry';
import { interpolateRgbBasis } from 'd3-interpolate';
import { fallBackTreshold } from './thresholds';
import { getScaleCalculator } from './scale';
import { reduceField } from '../transformations/fieldReducer';
/** @internal */
export var fieldColorModeRegistry = new Registry(function () {
    return [
        {
            id: FieldColorModeId.Fixed,
            name: 'Single color',
            description: 'Set a specific color',
            getCalculator: getFixedColor,
        },
        {
            id: FieldColorModeId.Thresholds,
            name: 'From thresholds',
            isByValue: true,
            description: 'Derive colors from thresholds',
            getCalculator: function (_field, theme) {
                return function (_value, _percent, threshold) {
                    var thresholdSafe = threshold !== null && threshold !== void 0 ? threshold : fallBackTreshold;
                    return theme.visualization.getColorByName(thresholdSafe.color);
                };
            },
        },
        new FieldColorSchemeMode({
            id: FieldColorModeId.PaletteClassic,
            name: 'Classic palette',
            isContinuous: false,
            isByValue: false,
            getColors: function (theme) {
                return theme.visualization.palette;
            },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-GrYlRd',
            name: 'Green-Yellow-Red',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['green', 'yellow', 'red']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-RdYlGr',
            name: 'Red-Yellow-Green',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['red', 'yellow', 'green']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-BlYlRd',
            name: 'Blue-Yellow-Red',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['dark-blue', 'super-light-yellow', 'dark-red']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-YlRd',
            name: 'Yellow-Red',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['super-light-yellow', 'dark-red']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-BlPu',
            name: 'Blue-Purple',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['blue', 'purple']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-YlBl',
            name: 'Yellow-Blue',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['super-light-yellow', 'dark-blue']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-blues',
            name: 'Blues',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['panel-bg', 'dark-blue']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-reds',
            name: 'Reds',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['panel-bg', 'dark-red']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-greens',
            name: 'Greens',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['panel-bg', 'dark-green']; },
        }),
        new FieldColorSchemeMode({
            id: 'continuous-purples',
            name: 'Purples',
            isContinuous: true,
            isByValue: true,
            getColors: function (theme) { return ['panel-bg', 'dark-purple']; },
        }),
    ];
});
var FieldColorSchemeMode = /** @class */ (function () {
    function FieldColorSchemeMode(options) {
        this.id = options.id;
        this.name = options.name;
        this.description = options.description;
        this.getNamedColors = options.getColors;
        this.isContinuous = options.isContinuous;
        this.isByValue = options.isByValue;
    }
    FieldColorSchemeMode.prototype.getColors = function (theme) {
        if (!this.getNamedColors) {
            return [];
        }
        if (this.colorCache && this.colorCacheTheme === theme) {
            return this.colorCache;
        }
        this.colorCache = this.getNamedColors(theme).map(theme.visualization.getColorByName);
        this.colorCacheTheme = theme;
        return this.colorCache;
    };
    FieldColorSchemeMode.prototype.getInterpolator = function () {
        if (!this.interpolator) {
            this.interpolator = interpolateRgbBasis(this.colorCache);
        }
        return this.interpolator;
    };
    FieldColorSchemeMode.prototype.getCalculator = function (field, theme) {
        var _this = this;
        var colors = this.getColors(theme);
        if (this.isByValue) {
            if (this.isContinuous) {
                return function (_, percent, _threshold) {
                    return _this.getInterpolator()(percent);
                };
            }
            else {
                return function (_, percent, _threshold) {
                    return colors[percent * (colors.length - 1)];
                };
            }
        }
        else {
            return function (_, _percent, _threshold) {
                var _a, _b;
                var seriesIndex = (_b = (_a = field.state) === null || _a === void 0 ? void 0 : _a.seriesIndex) !== null && _b !== void 0 ? _b : 0;
                return colors[seriesIndex % colors.length];
            };
        }
    };
    return FieldColorSchemeMode;
}());
export { FieldColorSchemeMode };
/** @beta */
export function getFieldColorModeForField(field) {
    var _a, _b;
    return fieldColorModeRegistry.get((_b = (_a = field.config.color) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : FieldColorModeId.Thresholds);
}
/** @beta */
export function getFieldColorMode(mode) {
    return fieldColorModeRegistry.get(mode !== null && mode !== void 0 ? mode : FieldColorModeId.Thresholds);
}
/**
 * @alpha
 * Function that will return a series color for any given color mode. If the color mode is a by value color
 * mode it will use the field.config.color.seriesBy property to figure out which value to use
 */
export function getFieldSeriesColor(field, theme) {
    var _a, _b, _c;
    var mode = getFieldColorModeForField(field);
    if (!mode.isByValue) {
        return {
            color: mode.getCalculator(field, theme)(0, 0),
            threshold: fallBackTreshold,
            percent: 1,
        };
    }
    var scale = getScaleCalculator(field, theme);
    var stat = (_b = (_a = field.config.color) === null || _a === void 0 ? void 0 : _a.seriesBy) !== null && _b !== void 0 ? _b : 'last';
    var calcs = reduceField({ field: field, reducers: [stat] });
    var value = (_c = calcs[stat]) !== null && _c !== void 0 ? _c : 0;
    return scale(value);
}
function getFixedColor(field, theme) {
    return function () {
        var _a, _b;
        return theme.visualization.getColorByName((_b = (_a = field.config.color) === null || _a === void 0 ? void 0 : _a.fixedColor) !== null && _b !== void 0 ? _b : FALLBACK_COLOR);
    };
}
//# sourceMappingURL=fieldColor.js.map