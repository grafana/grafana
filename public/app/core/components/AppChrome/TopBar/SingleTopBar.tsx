import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { memo } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Dropdown, Icon, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { ScopesSelector } from 'app/features/scopes';
import { useSelector } from 'app/types';

import { Branding } from '../../Branding/Branding';
import { Breadcrumbs } from '../../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../../Breadcrumbs/utils';
import { enrichHelpItem } from '../MegaMenu/utils';
import { NewsContainer } from '../News/NewsContainer';
import { QuickAdd } from '../QuickAdd/QuickAdd';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { SignInLink } from './SignInLink';
import { TopNavBarMenu } from './TopNavBarMenu';
import { TopSearchBarCommandPaletteTrigger } from './TopSearchBarCommandPaletteTrigger';
import { TopSearchBarSection } from './TopSearchBarSection';

interface Props {
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  onToggleMegaMenu(): void;
  onToggleKioskMode(): void;
}

export const SingleTopBar = memo(function SingleTopBar({
  onToggleMegaMenu,
  onToggleKioskMode,
  pageNav,
  sectionNav,
}: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const styles = useStyles2(getStyles, menuDockedAndOpen);
  const navIndex = useSelector((state) => state.navIndex);

  const helpNode = cloneDeep(navIndex['help']);
  const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;
  const profileNode = navIndex['profile'];
  const homeNav = useSelector((state) => state.navIndex)[HOME_NAV_ID];
  const breadcrumbs = buildBreadcrumbs(sectionNav, pageNav, homeNav);

  return (
    <div className={styles.layout}>
      <TopSearchBarSection>
        {!menuDockedAndOpen && (
          <ToolbarButton narrow onClick={onToggleMegaMenu} tooltip={t('navigation.megamenu.open', 'Open menu')}>
            <Stack gap={0} alignItems="center">
              <Branding.MenuLogo className={styles.img} />
              <Icon size="sm" name="angle-down" />
            </Stack>
          </ToolbarButton>
        )}
        <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbsWrapper} />
        <ScopesSelector />
      </TopSearchBarSection>

      <TopSearchBarSection align="right">
        <TopSearchBarCommandPaletteTrigger />
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
        <ToolbarButton className={styles.kioskToggle} onClick={onToggleKioskMode} narrow aria-label="Enable kiosk mode">
          <Icon name="angle-up" size="xl" />
        </ToolbarButton>
      </TopSearchBarSection>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2, menuDockedAndOpen: boolean) => ({
  layout: css({
    height: TOP_BAR_LEVEL_HEIGHT,
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    paddingLeft: menuDockedAndOpen ? theme.spacing(3.5) : theme.spacing(0.75),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',

    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: '2fr minmax(240px, 1fr)', // TODO probably change these values
      display: 'grid',

      justifyContent: 'flex-start',
    },
  }),
  breadcrumbsWrapper: css({
    display: 'flex',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      minWidth: '50%',
    },
  }),
  img: css({
    alignSelf: 'center',
    height: theme.spacing(3),
    width: theme.spacing(3),
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
  kioskToggle: css({
    [theme.breakpoints.down('lg')]: {
      display: 'none',
    },
  }),
});
