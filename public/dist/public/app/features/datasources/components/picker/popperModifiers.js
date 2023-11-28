import { detectOverflow } from '@popperjs/core';
const MODAL_MARGIN = 20;
const FLIP_THRESHOLD = 200;
export const maxSize = {
    name: 'maxSize',
    enabled: true,
    phase: 'main',
    requires: ['offset', 'preventOverflow', 'flip'],
    fn({ state, name, options }) {
        const overflow = detectOverflow(state, options);
        const { x, y } = state.modifiersData.preventOverflow || { x: 0, y: 0 };
        const { width: contentW, height: contentH } = state.rects.popper;
        const { width: triggerW } = state.rects.reference;
        const [basePlacement] = state.placement.split('-');
        const widthProp = basePlacement === 'left' ? 'left' : 'right';
        const heightProp = basePlacement === 'top' ? 'top' : 'bottom';
        state.modifiersData[name] = {
            maxWidth: contentW - overflow[widthProp] - x,
            maxHeight: contentH - overflow[heightProp] - y,
            minWidth: triggerW,
        };
    },
};
export const applyMaxSize = {
    name: 'applyMaxSize',
    enabled: true,
    phase: 'beforeWrite',
    requires: ['maxSize'],
    fn({ state }) {
        var _a, _b, _c, _d;
        var _e, _f, _g, _h;
        const { maxHeight, maxWidth, minWidth } = state.modifiersData.maxSize;
        (_a = (_e = state.styles.popper).maxHeight) !== null && _a !== void 0 ? _a : (_e.maxHeight = `${maxHeight - MODAL_MARGIN}px`);
        (_b = (_f = state.styles.popper).minHeight) !== null && _b !== void 0 ? _b : (_f.minHeight = `${FLIP_THRESHOLD}px`);
        (_c = (_g = state.styles.popper).maxWidth) !== null && _c !== void 0 ? _c : (_g.maxWidth = maxWidth);
        (_d = (_h = state.styles.popper).minWidth) !== null && _d !== void 0 ? _d : (_h.minWidth = minWidth);
    },
};
//# sourceMappingURL=popperModifiers.js.map