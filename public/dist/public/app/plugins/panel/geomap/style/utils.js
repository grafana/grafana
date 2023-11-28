import { __awaiter } from "tslib";
import { config } from '@grafana/runtime';
import { TextDimensionMode } from '@grafana/schema';
import { getMarkerMaker } from './markers';
import { HorizontalAlign, VerticalAlign, defaultStyleConfig, } from './types';
/** Indicate if the style wants to show text values */
export function styleUsesText(config) {
    var _a, _b;
    const text = config === null || config === void 0 ? void 0 : config.text;
    if (!text) {
        return false;
    }
    if (text.mode === TextDimensionMode.Fixed && ((_a = text.fixed) === null || _a === void 0 ? void 0 : _a.length)) {
        return true;
    }
    if (text.mode === TextDimensionMode.Field && ((_b = text.field) === null || _b === void 0 ? void 0 : _b.length)) {
        return true;
    }
    return false;
}
/** Return a distinct list of fields used to dynamically change the style */
export function getStyleConfigState(cfg) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    return __awaiter(this, void 0, void 0, function* () {
        if (!cfg) {
            cfg = defaultStyleConfig;
        }
        const hasText = styleUsesText(cfg);
        const fields = {};
        const maker = yield getMarkerMaker((_a = cfg.symbol) === null || _a === void 0 ? void 0 : _a.fixed, hasText);
        const state = {
            config: cfg,
            hasText,
            fields,
            base: {
                color: config.theme2.visualization.getColorByName((_c = (_b = cfg.color) === null || _b === void 0 ? void 0 : _b.fixed) !== null && _c !== void 0 ? _c : defaultStyleConfig.color.fixed),
                opacity: (_d = cfg.opacity) !== null && _d !== void 0 ? _d : defaultStyleConfig.opacity,
                lineWidth: (_e = cfg.lineWidth) !== null && _e !== void 0 ? _e : 1,
                size: (_g = (_f = cfg.size) === null || _f === void 0 ? void 0 : _f.fixed) !== null && _g !== void 0 ? _g : defaultStyleConfig.size.fixed,
                rotation: (_j = (_h = cfg.rotation) === null || _h === void 0 ? void 0 : _h.fixed) !== null && _j !== void 0 ? _j : defaultStyleConfig.rotation.fixed,
                symbolAlign: (_k = cfg.symbolAlign) !== null && _k !== void 0 ? _k : defaultStyleConfig.symbolAlign,
            },
            maker,
        };
        if ((_m = (_l = cfg.color) === null || _l === void 0 ? void 0 : _l.field) === null || _m === void 0 ? void 0 : _m.length) {
            fields.color = cfg.color.field;
        }
        if ((_p = (_o = cfg.size) === null || _o === void 0 ? void 0 : _o.field) === null || _p === void 0 ? void 0 : _p.length) {
            fields.size = cfg.size.field;
        }
        if ((_r = (_q = cfg.rotation) === null || _q === void 0 ? void 0 : _q.field) === null || _r === void 0 ? void 0 : _r.length) {
            fields.rotation = cfg.rotation.field;
        }
        if (hasText) {
            state.base.text = (_s = cfg.text) === null || _s === void 0 ? void 0 : _s.fixed;
            state.base.textConfig = (_t = cfg.textConfig) !== null && _t !== void 0 ? _t : defaultStyleConfig.textConfig;
            if ((_v = (_u = cfg.text) === null || _u === void 0 ? void 0 : _u.field) === null || _v === void 0 ? void 0 : _v.length) {
                fields.text = cfg.text.field;
            }
        }
        // Clear the fields if possible
        if (!Object.keys(fields).length) {
            state.fields = undefined;
        }
        return state;
    });
}
/** Return a displacment array depending on alignment and icon radius */
export function getDisplacement(symbolAlign, radius) {
    const displacement = [0, 0];
    if ((symbolAlign === null || symbolAlign === void 0 ? void 0 : symbolAlign.horizontal) === HorizontalAlign.Left) {
        displacement[0] = -radius;
    }
    else if ((symbolAlign === null || symbolAlign === void 0 ? void 0 : symbolAlign.horizontal) === HorizontalAlign.Right) {
        displacement[0] = radius;
    }
    if ((symbolAlign === null || symbolAlign === void 0 ? void 0 : symbolAlign.vertical) === VerticalAlign.Top) {
        displacement[1] = radius;
    }
    else if ((symbolAlign === null || symbolAlign === void 0 ? void 0 : symbolAlign.vertical) === VerticalAlign.Bottom) {
        displacement[1] = -radius;
    }
    return displacement;
}
//# sourceMappingURL=utils.js.map