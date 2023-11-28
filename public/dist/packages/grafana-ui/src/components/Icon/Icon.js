import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';
import { isIconName } from '@grafana/data';
import { useStyles2 } from '../../themes/ThemeContext';
import { getIconRoot, getIconSubDir, getSvgSize } from './utils';
const getIconStyles = (theme) => {
    return {
        // line-height: 0; is needed for correct icon alignment in Safari
        container: css({
            label: 'Icon',
            display: 'inline-block',
            lineHeight: 0,
        }),
        icon: css({
            verticalAlign: 'middle',
            display: 'inline-block',
            fill: 'currentColor',
        }),
        orange: css({
            fill: theme.v1.palette.orange,
        }),
    };
};
export const Icon = React.forwardRef((_a, ref) => {
    var { size = 'md', type = 'default', name, className, style, title = '' } = _a, divElementProps = __rest(_a, ["size", "type", "name", "className", "style", "title"]);
    const styles = useStyles2(getIconStyles);
    /* Temporary solution to display also font awesome icons */
    if (name === null || name === void 0 ? void 0 : name.startsWith('fa fa-')) {
        return React.createElement("i", Object.assign({ className: getFontAwesomeIconStyles(name, className) }, divElementProps, { style: style }));
    }
    if (!isIconName(name)) {
        console.warn('Icon component passed an invalid icon name', name);
    }
    if (!name || name.includes('..')) {
        return React.createElement("div", { ref: ref }, "invalid icon name");
    }
    const iconRoot = getIconRoot();
    const svgSize = getSvgSize(size);
    const svgHgt = svgSize;
    const svgWid = name.startsWith('gf-bar-align') ? 16 : name.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(name, type);
    const svgPath = `${iconRoot}${subDir}/${name}.svg`;
    return (React.createElement("div", Object.assign({ className: styles.container }, divElementProps, { ref: ref }),
        React.createElement(SVG, { src: svgPath, width: svgWid, height: svgHgt, title: title, className: cx(styles.icon, className, type === 'mono' ? { [styles.orange]: name === 'favorite' } : ''), style: style })));
});
Icon.displayName = 'Icon';
function getFontAwesomeIconStyles(iconName, className) {
    return cx(iconName, {
        'fa-spin': iconName === 'fa fa-spinner',
    }, className);
}
//# sourceMappingURL=Icon.js.map