import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { locationUtil, textUtil } from '@grafana/data';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';
import { Branding } from '../../Branding/Branding';
import { enrichHelpItem } from '../MegaMenu/utils';
import { NewsContainer } from '../News/NewsContainer';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { QuickAdd } from '../QuickAdd/QuickAdd';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';
import { SignInLink } from './SignInLink';
import { TopNavBarMenu } from './TopNavBarMenu';
import { TopSearchBarCommandPaletteTrigger } from './TopSearchBarCommandPaletteTrigger';
import { TopSearchBarSection } from './TopSearchBarSection';
export const TopSearchBar = React.memo(function TopSearchBar() {
    const styles = useStyles2(getStyles);
    const navIndex = useSelector((state) => state.navIndex);
    const location = useLocation();
    const helpNode = cloneDeep(navIndex['help']);
    const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;
    const profileNode = navIndex['profile'];
    let homeUrl = config.appSubUrl || '/';
    if (!config.bootData.user.isSignedIn && !config.anonymousEnabled) {
        homeUrl = textUtil.sanitizeUrl(locationUtil.getUrlForPartial(location, { forceLogin: 'true' }));
    }
    return (React.createElement("div", { className: styles.layout },
        React.createElement(TopSearchBarSection, null,
            React.createElement("a", { className: styles.logo, href: homeUrl, title: "Go to home" },
                React.createElement(Branding.MenuLogo, { className: styles.img })),
            React.createElement(OrganizationSwitcher, null)),
        React.createElement(TopSearchBarSection, null,
            React.createElement(TopSearchBarCommandPaletteTrigger, null)),
        React.createElement(TopSearchBarSection, { align: "right" },
            React.createElement(QuickAdd, null),
            enrichedHelpNode && (React.createElement(Dropdown, { overlay: () => React.createElement(TopNavBarMenu, { node: enrichedHelpNode }), placement: "bottom-end" },
                React.createElement(ToolbarButton, { iconOnly: true, icon: "question-circle", "aria-label": "Help" }))),
            config.newsFeedEnabled && React.createElement(NewsContainer, null),
            !contextSrv.user.isSignedIn && React.createElement(SignInLink, null),
            profileNode && (React.createElement(Dropdown, { overlay: () => React.createElement(TopNavBarMenu, { node: profileNode }), placement: "bottom-end" },
                React.createElement(ToolbarButton, { className: styles.profileButton, imgSrc: contextSrv.user.gravatarUrl, imgAlt: "User avatar", "aria-label": "Profile" }))))));
});
const getStyles = (theme) => ({
    layout: css({
        height: TOP_BAR_LEVEL_HEIGHT,
        display: 'flex',
        gap: theme.spacing(1),
        alignItems: 'center',
        padding: theme.spacing(0, 1, 0, 2),
        borderBottom: `1px solid ${theme.colors.border.weak}`,
        justifyContent: 'space-between',
        [theme.breakpoints.up('sm')]: {
            gridTemplateColumns: '1.5fr minmax(240px, 1fr) 1.5fr',
            display: 'grid',
            justifyContent: 'flex-start',
        },
    }),
    img: css({
        height: theme.spacing(3),
        width: theme.spacing(3),
    }),
    logo: css({
        display: 'flex',
    }),
    profileButton: css({
        padding: theme.spacing(0, 0.25),
        img: {
            borderRadius: theme.shape.radius.circle,
            height: '24px',
            marginRight: 0,
            width: '24px',
        },
    }),
});
//# sourceMappingURL=TopSearchBar.js.map