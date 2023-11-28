import { v4 as uuidv4 } from 'uuid';
const MATCH_ID_INDEX = 2;
const SVG_ID_INSERT_POS = 5;
export const getSvgStyle = (svgCode) => {
    const svgStyle = svgCode.match(new RegExp('<style type="text/css">([\\s\\S]*?)<\\/style>'));
    return svgStyle ? svgStyle[0] : null;
};
export const getSvgId = (svgCode) => {
    var _a;
    return (_a = svgCode.match(new RegExp('<svg.*id\\s*=\\s*([\'"])(.*?)\\1'))) === null || _a === void 0 ? void 0 : _a[MATCH_ID_INDEX];
};
export const svgStyleCleanup = (svgCode) => {
    let svgId = getSvgId(svgCode);
    if (!svgId) {
        svgId = `x${uuidv4()}`;
        const pos = svgCode.indexOf('<svg') + SVG_ID_INSERT_POS;
        svgCode = svgCode.substring(0, pos) + `id="${svgId}" ` + svgCode.substring(pos);
    }
    let svgStyle = getSvgStyle(svgCode);
    if (svgStyle) {
        let replacedId = svgStyle.replace(/(#(.*?))?\./g, `#${svgId} .`);
        svgCode = svgCode.replace(svgStyle, replacedId);
    }
    return svgCode;
};
//# sourceMappingURL=utils.js.map