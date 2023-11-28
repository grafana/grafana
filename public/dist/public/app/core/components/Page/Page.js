import { __rest } from "tslib";
// Libraries
import { css, cx } from '@emotion/css';
import React, { useLayoutEffect } from 'react';
import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';
export const Page = (_a) => {
    var { navId, navModel: oldNavProp, pageNav, renderTitle, onEditTitle, actions, subTitle, children, className, info, layout = PageLayoutType.Standard, scrollTop, scrollRef } = _a, otherProps = __rest(_a, ["navId", "navModel", "pageNav", "renderTitle", "onEditTitle", "actions", "subTitle", "children", "className", "info", "layout", "scrollTop", "scrollRef"]);
    const styles = useStyles2(getStyles);
    const navModel = usePageNav(navId, oldNavProp);
    const { chrome } = useGrafana();
    usePageTitle(navModel, pageNav);
    const pageHeaderNav = pageNav !== null && pageNav !== void 0 ? pageNav : navModel === null || navModel === void 0 ? void 0 : navModel.node;
    // We use useLayoutEffect here to make sure that the chrome is updated before the page is rendered
    // This prevents flickering sectionNav when going from dashboard to settings for example
    useLayoutEffect(() => {
        if (navModel) {
            chrome.update({
                sectionNav: navModel,
                pageNav: pageNav,
                layout: layout,
            });
        }
    }, [navModel, pageNav, chrome, layout]);
    return (React.createElement("div", Object.assign({ className: cx(styles.wrapper, className) }, otherProps),
        layout === PageLayoutType.Standard && (React.createElement(CustomScrollbar, { autoHeightMin: '100%', scrollTop: scrollTop, scrollRefCallback: scrollRef },
            React.createElement("div", { className: styles.pageInner },
                pageHeaderNav && (React.createElement(PageHeader, { actions: actions, onEditTitle: onEditTitle, navItem: pageHeaderNav, renderTitle: renderTitle, info: info, subTitle: subTitle })),
                pageNav && pageNav.children && React.createElement(PageTabs, { navItem: pageNav }),
                React.createElement("div", { className: styles.pageContent }, children)))),
        layout === PageLayoutType.Canvas && (React.createElement(CustomScrollbar, { autoHeightMin: '100%', scrollTop: scrollTop, scrollRefCallback: scrollRef },
            React.createElement("div", { className: styles.canvasContent }, children))),
        layout === PageLayoutType.Custom && children));
};
// @PERCONA
// @PERCONA_TODO alias for now but replace
export const OldPage = Page;
Page.Contents = PageContents;
OldPage.Contents = PageContents;
const getStyles = (theme) => {
    return {
        wrapper: css({
            label: 'page-wrapper',
            height: '100%',
            display: 'flex',
            flex: '1 1 0',
            flexDirection: 'column',
            minHeight: 0,
        }),
        pageContent: css({
            label: 'page-content',
            flexGrow: 1,
        }),
        pageInner: css({
            label: 'page-inner',
            padding: theme.spacing(2),
            borderRadius: theme.shape.radius.default,
            border: `1px solid ${theme.colors.border.weak}`,
            borderBottom: 'none',
            background: theme.colors.background.primary,
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            margin: theme.spacing(0, 0, 0, 0),
            [theme.breakpoints.up('md')]: {
                margin: theme.spacing(2, 2, 0, config.featureToggles.dockedMegaMenu ? 2 : 1),
                padding: theme.spacing(3),
            },
        }),
        canvasContent: css({
            label: 'canvas-content',
            display: 'flex',
            flexDirection: 'column',
            padding: theme.spacing(2),
            flexBasis: '100%',
            flexGrow: 1,
        }),
    };
};
//# sourceMappingURL=Page.js.map