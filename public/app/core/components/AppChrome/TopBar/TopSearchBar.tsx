import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { Dropdown, Icon, IconButton, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types';

import { Branding } from '../../Branding/Branding';
import { Breadcrumbs } from '../../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../../Breadcrumbs/utils';
import { MENU_WIDTH } from '../MegaMenu/MegaMenu';
import { enrichHelpItem } from '../MegaMenu/utils';
import { NewsContainer } from '../News/NewsContainer';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { QuickAdd } from '../QuickAdd/QuickAdd';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { SignInLink } from './SignInLink';
import { TopNavBarMenu } from './TopNavBarMenu';
import { TopSearchBarCommandPaletteTrigger } from './TopSearchBarCommandPaletteTrigger';
import { TopSearchBarSection } from './TopSearchBarSection';

interface Props {
  onToggleMegaMenu(): void;
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  isMenuDocked?: boolean;
}

export const TopSearchBar = React.memo(function TopSearchBar({
  onToggleMegaMenu,
  sectionNav,
  pageNav,
  isMenuDocked,
}: Props) {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);
  const helpNode = cloneDeep(navIndex['help']);
  const { chrome } = useGrafana();
  const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;
  const profileNode = navIndex['profile'];
  const homeNav = useSelector((state) => state.navIndex)[HOME_NAV_ID];
  const breadcrumbs = buildBreadcrumbs(sectionNav, pageNav, homeNav);

  const onCloseDockedMenu = () => {
    chrome.setMegaMenuDocked(false);
    chrome.setMegaMenuOpen(false);
  };

  return (
    <div className={styles.layout}>
      <TopSearchBarSection>
        {!isMenuDocked && (
          <>
            <button
              className={styles.logoButton}
              title="Open main menu"
              onClick={onToggleMegaMenu}
              data-testid={Components.NavBar.Toggle.button}
            >
              <Branding.MenuLogo className={styles.img} />
              <Icon name="angle-down" />
            </button>
          </>
        )}
        {isMenuDocked && (
          <div className={styles.dockedLogo}>
            <Stack grow={1} gap={2}>
              <Branding.MenuLogo className={styles.img} />
              Grafana
            </Stack>
            <IconButton
              id="dock-menu-button"
              tooltip={
                isMenuDocked
                  ? t('navigation.megamenu.undock', 'Undock menu')
                  : t('navigation.megamenu.dock', 'Dock menu')
              }
              name="web-section-alt"
              onClick={onCloseDockedMenu}
              variant="secondary"
            />
          </div>
        )}
        <OrganizationSwitcher />
        <Breadcrumbs isMenuDocked={isMenuDocked} breadcrumbs={breadcrumbs} className={styles.breadcrumbsWrapper} />
      </TopSearchBarSection>

      <TopSearchBarSection>
        <TopSearchBarCommandPaletteTrigger />
      </TopSearchBarSection>

      <TopSearchBarSection align="right">
        <QuickAdd />
        {enrichedHelpNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={enrichedHelpNode} />} placement="bottom-end">
            <ToolbarButton iconOnly icon="question-circle" aria-label="Help" />
          </Dropdown>
        )}
        {config.newsFeedEnabled && <NewsContainer />}
        {!contextSrv.user.isSignedIn && <SignInLink />}
        {profileNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={profileNode} />} placement="bottom-end">
            <ToolbarButton
              className={styles.profileButton}
              imgSrc={contextSrv.user.gravatarUrl}
              imgAlt="User avatar"
              aria-label="Profile"
            />
          </Dropdown>
        )}
      </TopSearchBarSection>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    height: TOP_BAR_LEVEL_HEIGHT,
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0, 1, 0, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',

    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: '1fr minmax(240px, min-content) min-content', // search should not be smaller than 240px
      display: 'grid',

      justifyContent: 'flex-start',
    },
  }),
  img: css({
    height: theme.spacing(3),
    width: theme.spacing(3),
  }),
  logoButton: css({
    display: 'flex',
    boxShadow: 'none',
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    alignItems: 'center',
    paddingLeft: 0,
  }),
  dockedLogo: css({
    width: MENU_WIDTH - 16,
    alignItems: 'center',
    //fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    gap: theme.spacing(1),
    borderRight: `1px solid ${theme.colors.border.weak}`,
    paddingRight: theme.spacing(0.5),
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
  breadcrumbsWrapper: css({
    display: 'flex',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      minWidth: '50%',
    },
  }),
});
