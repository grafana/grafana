import { __assign } from "tslib";
import { createBreakpoints } from './breakpoints';
import { createComponents } from './createComponents';
import { createColors } from './createColors';
import { createShadows } from './createShadows';
import { createShape } from './createShape';
import { createSpacing } from './createSpacing';
import { createTransitions } from './createTransitions';
import { createTypography } from './createTypography';
import { createV1Theme } from './createV1Theme';
import { zIndex } from './zIndex';
import { createVisualizationColors } from './createVisualizationColors';
/** @internal */
export function createTheme(options) {
    if (options === void 0) { options = {}; }
    var _a = options.name, name = _a === void 0 ? 'Dark' : _a, _b = options.colors, colorsInput = _b === void 0 ? {} : _b, _c = options.spacing, spacingInput = _c === void 0 ? {} : _c, _d = options.shape, shapeInput = _d === void 0 ? {} : _d, _e = options.typography, typographyInput = _e === void 0 ? {} : _e;
    var colors = createColors(colorsInput);
    var breakpoints = createBreakpoints();
    var spacing = createSpacing(spacingInput);
    var shape = createShape(shapeInput);
    var typography = createTypography(colors, typographyInput);
    var shadows = createShadows(colors);
    var transitions = createTransitions();
    var components = createComponents(colors, shadows);
    var visualization = createVisualizationColors(colors);
    var theme = {
        name: name,
        isDark: colors.mode === 'dark',
        isLight: colors.mode === 'light',
        colors: colors,
        breakpoints: breakpoints,
        spacing: spacing,
        shape: shape,
        components: components,
        typography: typography,
        shadows: shadows,
        transitions: transitions,
        visualization: visualization,
        zIndex: __assign({}, zIndex),
    };
    return __assign(__assign({}, theme), { v1: createV1Theme(theme) });
}
//# sourceMappingURL=createTheme.js.map