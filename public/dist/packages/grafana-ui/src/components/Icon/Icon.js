import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes/stylesFactory';
import { useTheme } from '../../themes/ThemeContext';
import SVG from 'react-inlinesvg';
import { cacheInitialized, initIconCache, iconRoot } from './iconBundle';
var alwaysMonoIcons = ['grafana', 'favorite', 'heart-break', 'heart', 'panel-add', 'library-panel'];
var getIconStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: Icon;\n      display: inline-block;\n    "], ["\n      label: Icon;\n      display: inline-block;\n    "]))),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      vertical-align: middle;\n      display: inline-block;\n      margin-bottom: ", ";\n      fill: currentColor;\n    "], ["\n      vertical-align: middle;\n      display: inline-block;\n      margin-bottom: ", ";\n      fill: currentColor;\n    "])), theme.spacing.xxs),
        orange: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      fill: ", ";\n    "], ["\n      fill: ", ";\n    "])), theme.palette.orange),
    };
});
function getIconSubDir(name, type) {
    return (name === null || name === void 0 ? void 0 : name.startsWith('gf-'))
        ? 'custom'
        : alwaysMonoIcons.includes(name)
            ? 'mono'
            : type === 'default'
                ? 'unicons'
                : 'mono';
}
export var Icon = React.forwardRef(function (_a, ref) {
    var _b;
    var _c = _a.size, size = _c === void 0 ? 'md' : _c, _d = _a.type, type = _d === void 0 ? 'default' : _d, name = _a.name, className = _a.className, style = _a.style, _e = _a.title, title = _e === void 0 ? '' : _e, divElementProps = __rest(_a, ["size", "type", "name", "className", "style", "title"]);
    var theme = useTheme();
    /* Temporary solution to display also font awesome icons */
    if (name === null || name === void 0 ? void 0 : name.startsWith('fa fa-')) {
        return React.createElement("i", __assign({ className: getFontAwesomeIconStyles(name, className) }, divElementProps, { style: style }));
    }
    if (name === 'panel-add') {
        size = 'xl';
    }
    if (!cacheInitialized) {
        initIconCache();
    }
    var styles = getIconStyles(theme);
    var svgSize = getSvgSize(size);
    var svgHgt = svgSize;
    var svgWid = (name === null || name === void 0 ? void 0 : name.startsWith('gf-bar-align')) ? 16 : (name === null || name === void 0 ? void 0 : name.startsWith('gf-interp')) ? 30 : svgSize;
    var subDir = getIconSubDir(name, type);
    var svgPath = "" + iconRoot + subDir + "/" + name + ".svg";
    return (React.createElement("div", __assign({ className: styles.container }, divElementProps, { ref: ref }),
        React.createElement(SVG, { src: svgPath, width: svgWid, height: svgHgt, title: title, className: cx(styles.icon, className, type === 'mono' ? (_b = {}, _b[styles.orange] = name === 'favorite', _b) : ''), style: style })));
});
Icon.displayName = 'Icon';
function getFontAwesomeIconStyles(iconName, className) {
    return cx(iconName, {
        'fa-spin': iconName === 'fa fa-spinner',
    }, className);
}
/* Transform string with px to number and add 2 pxs as path in svg is 2px smaller */
export var getSvgSize = function (size) {
    switch (size) {
        case 'xs':
            return 12;
        case 'sm':
            return 14;
        case 'md':
            return 16;
        case 'lg':
            return 18;
        case 'xl':
            return 24;
        case 'xxl':
            return 36;
        case 'xxxl':
            return 48;
    }
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=Icon.js.map