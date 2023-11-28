import { __rest } from "tslib";
import React from 'react';
import SVG from 'react-inlinesvg';
import { textUtil } from '@grafana/data';
import { svgStyleCleanup } from './utils';
export const SanitizedSVG = (props) => {
    const { cleanStyle } = props, inlineSvgProps = __rest(props, ["cleanStyle"]);
    return React.createElement(SVG, Object.assign({}, inlineSvgProps, { cacheRequests: true, preProcessor: cleanStyle ? getCleanSVGAndStyle : getCleanSVG }));
};
let cache = new Map();
function getCleanSVG(code) {
    let clean = cache.get(code);
    if (!clean) {
        clean = textUtil.sanitizeSVGContent(code);
        cache.set(code, clean);
    }
    return clean;
}
function getCleanSVGAndStyle(code) {
    let clean = cache.get(code);
    if (!clean) {
        clean = textUtil.sanitizeSVGContent(code);
        if (clean.indexOf('<style type="text/css">') > -1) {
            clean = svgStyleCleanup(clean);
        }
        cache.set(code, clean);
    }
    return clean;
}
//# sourceMappingURL=SanitizedSVG.js.map