import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { useStyles2, CustomScrollbar, useTheme2 } from '@grafana/ui';
import { SectionNavItem } from './SectionNavItem';
import { SectionNavToggle } from './SectionNavToggle';
export function SectionNav({ model }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const { isExpanded, onToggleSectionNav } = useSectionNavState();
    if (!Boolean((_b = (_a = model.main) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.length)) {
        return null;
    }
    return (React.createElement("div", { className: styles.navContainer },
        React.createElement("nav", { className: cx(styles.nav, {
                [styles.navExpanded]: isExpanded,
            }) },
            React.createElement(CustomScrollbar, { showScrollIndicators: true },
                React.createElement("div", { className: styles.items, role: "tablist" },
                    React.createElement(SectionNavItem, { item: model.main, isSectionRoot: true })))),
        React.createElement(SectionNavToggle, { isExpanded: isExpanded, onClick: onToggleSectionNav })));
}
function useSectionNavState() {
    const theme = useTheme2();
    const isSmallScreen = window.matchMedia(`(max-width: ${theme.breakpoints.values.lg}px)`).matches;
    const [navExpandedPreference, setNavExpandedPreference] = useLocalStorage('grafana.sectionNav.expanded', !isSmallScreen);
    const [isExpanded, setIsExpanded] = useState(!isSmallScreen && navExpandedPreference);
    useEffect(() => {
        const mediaQuery = window.matchMedia(`(max-width: ${theme.breakpoints.values.lg}px)`);
        const onMediaQueryChange = (e) => setIsExpanded(e.matches ? false : navExpandedPreference);
        mediaQuery.addEventListener('change', onMediaQueryChange);
        return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
    }, [navExpandedPreference, theme.breakpoints.values.lg]);
    const onToggleSectionNav = () => {
        setNavExpandedPreference(!isExpanded);
        setIsExpanded(!isExpanded);
    };
    return { isExpanded, onToggleSectionNav };
}
const getStyles = (theme) => {
    return {
        navContainer: css({
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            [theme.breakpoints.up('md')]: {
                flexDirection: 'row',
            },
        }),
        nav: css({
            display: 'flex',
            flexDirection: 'column',
            background: theme.colors.background.canvas,
            flexShrink: 0,
            transition: theme.transitions.create(['width', 'max-height']),
            maxHeight: 0,
            visibility: 'hidden',
            [theme.breakpoints.up('md')]: {
                width: 0,
                maxHeight: 'unset',
            },
        }),
        navExpanded: css({
            maxHeight: '50vh',
            visibility: 'visible',
            [theme.breakpoints.up('md')]: {
                width: '250px',
                maxHeight: 'unset',
            },
        }),
        items: css({
            display: 'flex',
            flexDirection: 'column',
            padding: theme.spacing(2, 1, 2, 2),
            minWidth: '250px',
            [theme.breakpoints.up('md')]: {
                padding: theme.spacing(4.5, 1, 2, 2),
            },
        }),
    };
};
//# sourceMappingURL=SectionNav.js.map