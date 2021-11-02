import { __assign, __read, __spreadArray } from "tslib";
import { omit } from 'lodash';
import { DisplayMode } from './types';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
export function calculatePanelSize(mode, width, height, panel) {
    if (mode === DisplayMode.Fill) {
        return { width: width, height: height };
    }
    var panelPadding = 8 * 6;
    var sidebarWidth = 60;
    var colWidth = (window.innerWidth - sidebarWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;
    var pWidth = colWidth * panel.gridPos.w;
    var pHeight = GRID_CELL_HEIGHT * panel.gridPos.h + panelPadding;
    var scale = Math.min(width / pWidth, height / pHeight);
    if (pWidth <= width && pHeight <= height) {
        return {
            width: pWidth,
            height: pHeight,
        };
    }
    return {
        width: pWidth * scale,
        height: pHeight * scale,
    };
}
export function supportsDataQuery(plugin) {
    return (plugin === null || plugin === void 0 ? void 0 : plugin.meta.skipDataQuery) === false;
}
export var updateDefaultFieldConfigValue = function (config, name, value, isCustom) {
    var defaults = __assign({}, config.defaults);
    var remove = value == null || value === '';
    if (isCustom) {
        if (defaults.custom) {
            if (remove) {
                defaults.custom = omit(defaults.custom, name);
            }
            else {
                defaults.custom = setOptionImmutably(defaults.custom, name, value);
            }
        }
        else if (!remove) {
            defaults.custom = setOptionImmutably(defaults.custom, name, value);
        }
    }
    else if (remove) {
        defaults = omit(defaults, name);
    }
    else {
        defaults = setOptionImmutably(defaults, name, value);
    }
    return __assign(__assign({}, config), { defaults: defaults });
};
export function setOptionImmutably(options, path, value) {
    var _a, _b, _c;
    var splat = !Array.isArray(path) ? path.split('.') : path;
    var key = splat.shift();
    if (key.endsWith(']')) {
        var idx = key.lastIndexOf('[');
        var index = +key.substring(idx + 1, key.length - 1);
        var propKey = key.substr(0, idx);
        var current_1 = options[propKey];
        var arr = Array.isArray(current_1) ? __spreadArray([], __read(current_1), false) : [];
        if (splat.length) {
            current_1 = arr[index];
            if (current_1 == null || typeof current_1 !== 'object') {
                current_1 = {};
            }
            value = setOptionImmutably(current_1, splat, value);
        }
        arr[index] = value;
        return __assign(__assign({}, options), (_a = {}, _a[propKey] = arr, _a));
    }
    if (!splat.length) {
        return __assign(__assign({}, options), (_b = {}, _b[key] = value, _b));
    }
    var current = options[key];
    if (current == null || typeof current !== 'object') {
        current = {};
    }
    return __assign(__assign({}, options), (_c = {}, _c[key] = setOptionImmutably(current, splat, value), _c));
}
//# sourceMappingURL=utils.js.map