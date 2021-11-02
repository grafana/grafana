import { __assign, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { styleMixins, stylesFactory, useTheme2 } from '../../themes';
var CardInner = function (_a) {
    var children = _a.children, href = _a.href;
    var theme = useTheme2();
    var inner = getCardContainerStyles(theme).inner;
    return href ? (React.createElement("a", { className: inner, href: href }, children)) : (React.createElement("div", { className: inner }, children));
};
export var CardContainer = function (_a) {
    var href = _a.href, children = _a.children, disableEvents = _a.disableEvents, disableHover = _a.disableHover, className = _a.className, props = __rest(_a, ["href", "children", "disableEvents", "disableHover", "className"]);
    var theme = useTheme2();
    var container = getCardContainerStyles(theme, disableEvents, disableHover).container;
    return (React.createElement("div", __assign({}, props, { className: cx(container, className) }),
        React.createElement(CardInner, { href: href }, children)));
};
var getCardContainerStyles = stylesFactory(function (theme, disabled, disableHover) {
    if (disabled === void 0) { disabled = false; }
    if (disableHover === void 0) { disableHover = false; }
    return {
        container: css(__assign({ display: 'flex', width: '100%', background: theme.colors.background.secondary, borderRadius: theme.shape.borderRadius(), position: 'relative', pointerEvents: disabled ? 'none' : 'auto', marginBottom: theme.spacing(1), transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
                duration: theme.transitions.duration.short,
            }) }, (!disableHover && {
            '&:hover': {
                background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
                cursor: 'pointer',
                zIndex: 1,
            },
            '&:focus': styleMixins.getFocusStyles(theme),
        }))),
        inner: css({
            display: 'flex',
            width: '100%',
            padding: theme.spacing(2),
        }),
    };
});
//# sourceMappingURL=CardContainer.js.map