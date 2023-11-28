import { css, cx } from '@emotion/css';
import React, { useCallback, useState, useRef, useImperativeHandle } from 'react';
import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
import { SubMenu } from './SubMenu';
/** @internal */
export const MenuItem = React.memo(React.forwardRef((props, ref) => {
    const { url, icon, label, ariaLabel, ariaChecked, target, onClick, className, active, disabled, destructive, childItems, role = 'menuitem', tabIndex = -1, customSubMenuContainerStyles, shortcut, testId, } = props;
    const styles = useStyles2(getStyles);
    const [isActive, setIsActive] = useState(active);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [openedWithArrow, setOpenedWithArrow] = useState(false);
    const onMouseEnter = useCallback(() => {
        if (disabled) {
            return;
        }
        setIsSubMenuOpen(true);
        setIsActive(true);
    }, [disabled]);
    const onMouseLeave = useCallback(() => {
        if (disabled) {
            return;
        }
        setIsSubMenuOpen(false);
        setIsActive(false);
    }, [disabled]);
    const hasSubMenu = childItems && childItems.length > 0;
    const ItemElement = hasSubMenu ? 'div' : url === undefined ? 'button' : 'a';
    const itemStyle = cx({
        [styles.item]: true,
        [styles.active]: isActive,
        [styles.disabled]: disabled,
        [styles.destructive]: destructive && !disabled,
    }, className);
    const disabledProps = Object.assign(Object.assign({ [ItemElement === 'button' ? 'disabled' : 'aria-disabled']: disabled }, (ItemElement === 'a' && disabled && { href: undefined, onClick: undefined })), (disabled && {
        tabIndex: -1,
        ['data-disabled']: disabled, // used to identify disabled items in Menu.tsx
    }));
    const localRef = useRef(null);
    useImperativeHandle(ref, () => localRef.current);
    const handleKeys = (event) => {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                event.stopPropagation();
                if (hasSubMenu) {
                    setIsSubMenuOpen(true);
                    setOpenedWithArrow(true);
                    setIsActive(true);
                }
                break;
            default:
                break;
        }
    };
    const closeSubMenu = () => {
        var _a;
        setIsSubMenuOpen(false);
        setIsActive(false);
        (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.focus();
    };
    const hasShortcut = Boolean(shortcut && shortcut.length > 0);
    return (React.createElement(ItemElement, Object.assign({ target: target, className: itemStyle, rel: target === '_blank' ? 'noopener noreferrer' : undefined, href: url, onClick: onClick, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, onKeyDown: handleKeys, role: url === undefined ? role : undefined, "data-role": "menuitem" // used to identify menuitem in Menu.tsx
        , ref: localRef, "data-testid": testId, "aria-label": ariaLabel, "aria-checked": ariaChecked, tabIndex: tabIndex }, disabledProps),
        React.createElement(React.Fragment, null,
            icon && React.createElement(Icon, { name: icon, className: styles.icon, "aria-hidden": true }),
            label,
            React.createElement("div", { className: cx(styles.rightWrapper, { [styles.withShortcut]: hasShortcut }) },
                hasShortcut && (React.createElement("div", { className: styles.shortcut },
                    React.createElement(Icon, { name: "keyboard", title: "keyboard shortcut" }),
                    shortcut)),
                hasSubMenu && (React.createElement(SubMenu, { items: childItems, isOpen: isSubMenuOpen, openedWithArrow: openedWithArrow, setOpenedWithArrow: setOpenedWithArrow, close: closeSubMenu, customStyle: customSubMenuContainerStyles }))))));
}));
MenuItem.displayName = 'MenuItem';
const getStyles = (theme) => {
    return {
        item: css({
            background: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            color: theme.colors.text.primary,
            display: 'flex',
            alignItems: 'center',
            padding: theme.spacing(0.5, 2),
            minHeight: theme.spacing(4),
            margin: 0,
            border: 'none',
            width: '100%',
            position: 'relative',
            '&:hover, &:focus, &:focus-visible': {
                background: theme.colors.action.hover,
                color: theme.colors.text.primary,
                textDecoration: 'none',
            },
            '&:focus-visible': getFocusStyles(theme),
        }),
        active: css({
            background: theme.colors.action.hover,
        }),
        destructive: css({
            color: theme.colors.error.text,
            svg: {
                color: theme.colors.error.text,
            },
            '&:hover, &:focus, &:focus-visible': {
                background: theme.colors.error.main,
                color: theme.colors.error.contrastText,
                svg: {
                    color: theme.colors.error.contrastText,
                },
            },
        }),
        disabled: css({
            color: theme.colors.action.disabledText,
            '&:hover, &:focus, &:focus-visible': {
                cursor: 'not-allowed',
                background: 'none',
                color: theme.colors.action.disabledText,
            },
        }),
        icon: css({
            opacity: 0.7,
            marginRight: '10px',
            marginLeft: '-4px',
            color: theme.colors.text.secondary,
        }),
        rightWrapper: css({
            display: 'flex',
            alignItems: 'center',
            marginLeft: 'auto',
        }),
        shortcutIcon: css({
            marginRight: theme.spacing(1),
        }),
        withShortcut: css({
            minWidth: theme.spacing(10.5),
        }),
        shortcut: css({
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(1),
            marginLeft: theme.spacing(2),
            color: theme.colors.text.secondary,
            opacity: 0.7,
        }),
    };
};
//# sourceMappingURL=MenuItem.js.map