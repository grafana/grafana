import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, useStyles2, useTheme2, ToolbarButton } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { useSelector } from 'app/types';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';
import { findCreateActions } from './utils';
export const QuickAdd = ({}) => {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    const navBarTree = useSelector((state) => state.navBarTree);
    const breakpoint = theme.breakpoints.values.sm;
    const [isOpen, setIsOpen] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(!window.matchMedia(`(min-width: ${breakpoint}px)`).matches);
    const createActions = useMemo(() => findCreateActions(navBarTree), [navBarTree]);
    useMediaQueryChange({
        breakpoint,
        onChange: (e) => {
            setIsSmallScreen(!e.matches);
        },
    });
    const MenuActions = () => {
        return (React.createElement(Menu, null, createActions.map((createAction, index) => (React.createElement(Menu.Item, { key: index, url: createAction.url, label: createAction.text, onClick: () => reportInteraction('grafana_menu_item_clicked', { url: createAction.url, from: 'quickadd' }) })))));
    };
    return createActions.length > 0 ? (React.createElement(React.Fragment, null,
        React.createElement(Dropdown, { overlay: MenuActions, placement: "bottom-end", onVisibleChange: setIsOpen },
            React.createElement(ToolbarButton, { iconOnly: true, icon: isSmallScreen ? 'plus-circle' : 'plus', isOpen: isSmallScreen ? undefined : isOpen, "aria-label": "New" })),
        React.createElement(NavToolbarSeparator, { className: styles.separator }))) : null;
};
const getStyles = (theme) => ({
    buttonContent: css({
        alignItems: 'center',
        display: 'flex',
    }),
    buttonText: css({
        [theme.breakpoints.down('md')]: {
            display: 'none',
        },
    }),
    separator: css({
        [theme.breakpoints.down('sm')]: {
            display: 'none',
        },
    }),
});
//# sourceMappingURL=QuickAdd.js.map