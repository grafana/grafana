import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { useMenuFocus } from './hooks';
import { isElementOverflowing } from './utils';
/** @internal */
export const SubMenu = React.memo(({ items, isOpen, openedWithArrow, setOpenedWithArrow, close, customStyle }) => {
    const styles = useStyles2(getStyles);
    const localRef = useRef(null);
    const [handleKeys] = useMenuFocus({
        localRef,
        isMenuOpen: isOpen,
        openedWithArrow,
        setOpenedWithArrow,
        close,
    });
    const [pushLeft, setPushLeft] = useState(false);
    useEffect(() => {
        if (isOpen && localRef.current) {
            setPushLeft(isElementOverflowing(localRef.current));
        }
    }, [isOpen]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.iconWrapper, "aria-label": selectors.components.Menu.SubMenu.icon },
            React.createElement(Icon, { name: "angle-right", className: styles.icon, "aria-hidden": true })),
        isOpen && (React.createElement("div", { ref: localRef, className: cx(styles.subMenu, { [styles.pushLeft]: pushLeft }), "aria-label": selectors.components.Menu.SubMenu.container, style: customStyle },
            React.createElement("div", { tabIndex: -1, className: styles.itemsWrapper, role: "menu", onKeyDown: handleKeys }, items)))));
});
SubMenu.displayName = 'SubMenu';
/** @internal */
const getStyles = (theme) => {
    return {
        iconWrapper: css({
            display: 'flex',
            flex: 1,
            justifyContent: 'end',
        }),
        icon: css({
            opacity: 0.7,
            marginLeft: theme.spacing(1),
            color: theme.colors.text.secondary,
        }),
        itemsWrapper: css({
            background: theme.colors.background.primary,
            boxShadow: theme.shadows.z3,
            display: 'inline-block',
            borderRadius: theme.shape.radius.default,
        }),
        pushLeft: css({
            right: '100%',
            left: 'unset',
        }),
        subMenu: css({
            position: 'absolute',
            top: 0,
            left: '100%',
            zIndex: theme.zIndex.dropdown,
        }),
    };
};
//# sourceMappingURL=SubMenu.js.map