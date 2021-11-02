import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/react';
import 'ol/ol.css';
/**
 * Will be loaded *after* the css above
 */
export function getGlobalStyles(theme) {
    // NOTE: this works with
    //  node_modules/ol/ol.css
    // use !important;
    // This file keeps the rules
    // .ol-box {
    //   border: 2px solid blue;
    // }
    // .ol-scale-step-marker {
    //   background-color: #000000;
    // }
    // .ol-scale-step-text {
    //   color: #000000;
    //   text-shadow: -2px 0 #FFFFFF, 0 2px #FFFFFF, 2px 0 #FFFFFF, 0 -2px #FFFFFF;
    // }
    // .ol-scale-text {
    //   color: #000000;
    //   text-shadow: -2px 0 #FFFFFF, 0 2px #FFFFFF, 2px 0 #FFFFFF, 0 -2px #FFFFFF;
    // }
    // .ol-scale-singlebar {
    //   border: 1px solid black;
    // }
    // .ol-viewport, .ol-unselectable {
    //   -webkit-tap-highlight-color: rgba(0,0,0,0);
    // }
    // .ol-overviewmap .ol-overviewmap-map {
    //   border: 1px solid #7b98bc;
    // }
    // .ol-overviewmap:not(.ol-collapsed) {
    //   background: rgba(255,255,255,0.8);
    // }
    // .ol-overviewmap-box {
    //   border: 2px dotted rgba(0,60,136,0.7);
    // }
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    .ol-scale-line {\n      background: ", "; // rgba(0,60,136,0.3);\n    }\n    .ol-scale-line-inner {\n      border: 1px solid ", "; // #eee;\n      border-top: 0px;\n      color: ", "; //  #eee;\n    }\n    .ol-control {\n      background-color: ", "; //rgba(255,255,255,0.4);\n    }\n    .ol-control:hover {\n      background-color: ", "; // rgba(255,255,255,0.6);\n    }\n    .ol-control button {\n      color: ", "; // white;\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-control button:hover {\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-control button:focus {\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-attribution ul {\n      color: ", "; //  #000;\n      text-shadow: none;\n    }\n    .ol-attribution:not(.ol-collapsed) {\n      background-color: ", "; // rgba(255,255,255,0.8);\n    }\n  "], ["\n    .ol-scale-line {\n      background: ", "; // rgba(0,60,136,0.3);\n    }\n    .ol-scale-line-inner {\n      border: 1px solid ", "; // #eee;\n      border-top: 0px;\n      color: ", "; //  #eee;\n    }\n    .ol-control {\n      background-color: ", "; //rgba(255,255,255,0.4);\n    }\n    .ol-control:hover {\n      background-color: ", "; // rgba(255,255,255,0.6);\n    }\n    .ol-control button {\n      color: ", "; // white;\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-control button:hover {\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-control button:focus {\n      background-color: ", "; // rgba(0,60,136,0.5);\n    }\n    .ol-attribution ul {\n      color: ", "; //  #000;\n      text-shadow: none;\n    }\n    .ol-attribution:not(.ol-collapsed) {\n      background-color: ", "; // rgba(255,255,255,0.8);\n    }\n  "])), theme.colors.border.weak, theme.colors.text.primary, theme.colors.text.primary, theme.colors.background.secondary, theme.colors.action.hover, theme.colors.secondary.text, theme.colors.secondary.main, theme.colors.secondary.shade, theme.colors.secondary.main, theme.colors.text.primary, theme.colors.background.secondary);
}
var templateObject_1;
//# sourceMappingURL=globalStyles.js.map