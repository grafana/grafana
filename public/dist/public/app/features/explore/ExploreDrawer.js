import { __makeTemplateObject } from "tslib";
// Libraries
import React from 'react';
import { Resizable } from 're-resizable';
import { css, cx, keyframes } from '@emotion/css';
// Services & Utils
import { stylesFactory, useTheme2 } from '@grafana/ui';
var drawerSlide = keyframes(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  0% {\n    transform: translateY(400px);\n  }\n\n  100% {\n    transform: translateY(0px);\n  }\n"], ["\n  0% {\n    transform: translateY(400px);\n  }\n\n  100% {\n    transform: translateY(0px);\n  }\n"])));
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: fixed !important;\n      bottom: 0;\n      background: ", ";\n      border-top: 1px solid ", ";\n      margin: ", ";\n      box-shadow: ", ";\n      z-index: ", ";\n    "], ["\n      position: fixed !important;\n      bottom: 0;\n      background: ", ";\n      border-top: 1px solid ", ";\n      margin: ", ";\n      box-shadow: ", ";\n      z-index: ", ";\n    "])), theme.colors.background.primary, theme.colors.border.weak, theme.spacing(0, -2, 0, -2), theme.shadows.z3, theme.zIndex.sidemenu),
        drawerActive: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      opacity: 1;\n      animation: 0.5s ease-out ", ";\n    "], ["\n      opacity: 1;\n      animation: 0.5s ease-out ", ";\n    "])), drawerSlide),
        rzHandle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      background: ", ";\n      transition: 0.3s background ease-in-out;\n      position: relative;\n      width: 200px !important;\n      height: 7px !important;\n      left: calc(50% - 100px) !important;\n      top: -4px !important;\n      cursor: grab;\n      border-radius: 4px;\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      background: ", ";\n      transition: 0.3s background ease-in-out;\n      position: relative;\n      width: 200px !important;\n      height: 7px !important;\n      left: calc(50% - 100px) !important;\n      top: -4px !important;\n      cursor: grab;\n      border-radius: 4px;\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.secondary.main, theme.colors.secondary.shade),
    };
});
export function ExploreDrawer(props) {
    var width = props.width, children = props.children, onResize = props.onResize;
    var theme = useTheme2();
    var styles = getStyles(theme);
    var drawerWidth = width + 31.5 + "px";
    return (React.createElement(Resizable, { className: cx(styles.container, styles.drawerActive), defaultSize: { width: drawerWidth, height: '400px' }, handleClasses: { top: styles.rzHandle }, enable: {
            top: true,
            right: false,
            bottom: false,
            left: false,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
        }, maxHeight: "100vh", maxWidth: drawerWidth, minWidth: drawerWidth, onResize: onResize }, children));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=ExploreDrawer.js.map