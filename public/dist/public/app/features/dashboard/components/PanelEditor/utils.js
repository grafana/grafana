import { omit } from 'lodash';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DisplayMode } from './types';
export function calculatePanelSize(mode, width, height, panel) {
    if (mode === DisplayMode.Fill) {
        return { width, height };
    }
    const panelPadding = 8 * 6;
    const sidebarWidth = 60;
    const colWidth = (window.innerWidth - sidebarWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;
    const pWidth = colWidth * panel.gridPos.w;
    const pHeight = GRID_CELL_HEIGHT * panel.gridPos.h + panelPadding;
    const scale = Math.min(width / pWidth, height / pHeight);
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
export const updateDefaultFieldConfigValue = (config, name, value, isCustom) => {
    let defaults = Object.assign({}, config.defaults);
    const remove = value == null || value === '';
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
    return Object.assign(Object.assign({}, config), { defaults });
};
export function setOptionImmutably(options, path, value) {
    const splat = !Array.isArray(path) ? path.split('.') : path;
    const key = splat.shift();
    if (key.endsWith(']')) {
        const idx = key.lastIndexOf('[');
        const index = +key.substring(idx + 1, key.length - 1);
        const propKey = key.substring(0, idx);
        let current = options[propKey];
        const arr = Array.isArray(current) ? [...current] : [];
        if (splat.length) {
            current = arr[index];
            if (current == null || typeof current !== 'object') {
                current = {};
            }
            value = setOptionImmutably(current, splat, value);
        }
        arr[index] = value;
        return Object.assign(Object.assign({}, options), { [propKey]: arr });
    }
    if (!splat.length) {
        return Object.assign(Object.assign({}, options), { [key]: value });
    }
    let current = options[key];
    if (current == null || typeof current !== 'object') {
        current = {};
    }
    return Object.assign(Object.assign({}, options), { [key]: setOptionImmutably(current, splat, value) });
}
//# sourceMappingURL=utils.js.map