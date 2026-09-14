import { css, cx } from '@emotion/css';
import { useLayoutEffect } from 'react';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import NativeScrollbar from '../NativeScrollbar';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { type PageType } from './types';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';

export const Page: PageType = ({
  navId,
  navModel: oldNavProp,
  pageNav,
  renderTitle,
  onEditTitle,
  actions,
  subTitle,
  children,
  className,
  info,
  layout = PageLayoutType.Standard,
  onSetScrollRef,
  // TODO deprecate and remove this prop once visual refresh is delivered
  // there is only 1 page background - consumers can customise the background by setting layout to custom and providing their own background
  background,
  ...otherProps
}) => {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, visualRefreshEnabled);
  const navModel = usePageNav(navId, oldNavProp);
  const { chrome } = useGrafana();

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.node;

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

  const resolvedBg = background ?? getDefaultBackgroundForLayout(layout, visualRefreshEnabled);

  return (
    <div
      className={cx(
        styles.wrapper,
        resolvedBg === 'primary' && styles.wrapperPrimary,
        resolvedBg === 'gradient' && styles.wrapperGradient,
        className
      )}
      {...otherProps}
    >
      {(layout === PageLayoutType.Standard || layout === PageLayoutType.Home) && (
        <NativeScrollbar
          // This id is used by the image renderer to scroll through the dashboard
          divId="page-scrollbar"
          onSetScrollRef={onSetScrollRef}
        >
          <div className={cx(styles.pageInner, layout === PageLayoutType.Home && styles.homeInner)}>
            {pageHeaderNav && (
              <PageHeader
                actions={actions}
                onEditTitle={onEditTitle}
                navItem={pageHeaderNav}
                renderTitle={renderTitle}
                info={info}
                subTitle={subTitle}
              />
            )}
            {pageNav && pageNav.children && <PageTabs navItem={pageNav} />}
            <div className={styles.pageContent}>{children}</div>
          </div>
        </NativeScrollbar>
      )}

      {layout === PageLayoutType.Canvas && (
        <NativeScrollbar
          // This id is used by the image renderer to scroll through the dashboard
          divId="page-scrollbar"
          onSetScrollRef={onSetScrollRef}
        >
          <div className={styles.canvasContent}>{children}</div>
        </NativeScrollbar>
      )}

      {layout === PageLayoutType.Custom && children}
    </div>
  );
};

Page.Contents = PageContents;

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => {
  return {
    wrapper: css(
      {
        label: 'page-wrapper',
        display: 'flex',
        flex: '1 1 0',
        flexDirection: 'column',
        position: 'relative',
        container: 'page / inline-size',
      },
      visualRefreshEnabled && {
        borderRadius: theme.shape.radius.lg,
        margin: theme.spacing(0, 0.5, 0.5, 0.5),
        border: `1px solid ${theme.colors.border.weak}`,
      }
    ),
    wrapperPrimary: css({
      label: 'page-wrapper-primary',
      background: theme.colors.background.page,
    }),
    wrapperGradient: css({
      label: 'page-wrapper-gradient',
      background: `url('data:image/svg+xml;utf8,${encodeURIComponent(getGradientBackgroundForTheme(theme))}') center center / cover no-repeat`,
    }),
    pageContent: css({
      label: 'page-content',
      flexGrow: 1,
    }),
    pageInner: css({
      label: 'page-inner',
      padding: theme.spacing(2),
      borderBottom: 'none',
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      margin: theme.spacing(0, 0, 0, 0),

      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4),
      },
    }),
    homeInner: css({
      label: 'home-inner',
      maxWidth: `${theme.breakpoints.values.xxl}px`,
      width: '100%',
      margin: '0 auto',
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

function getDefaultBackgroundForLayout(layout: PageLayoutType, visualRefreshEnabled: boolean) {
  if (layout === PageLayoutType.Standard) {
    return 'primary';
  }

  if (layout === PageLayoutType.Home) {
    return 'gradient';
  }

  return visualRefreshEnabled ? 'primary' : 'canvas';
}

function getGradientBackgroundForTheme(theme: GrafanaTheme2) {
  // Use an inline SVG as a background to avoid flashing of the background when loading a page
  // Use an inline SVG rather than a CSS gradient due to the complexity of the gradients being used
  return `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 3840 2160">
  <rect width="3840" height="2160" fill="${theme.colors.background.page}" />
  <rect width="3840" height="2160" fill="url(#fade)" fill-opacity="0.5"/>
  <rect width="3840" height="2160" fill="url(#highlight)" fill-opacity="0.25"/>
  <rect width="3840" height="2160" fill="url(#right)" fill-opacity="0.20"/>
  <rect width="3840" height="2160" fill="url(#left)" fill-opacity="0.25"/>
  <defs>
    <linearGradient id="fade" x1="1920" x2="1920" y1="0" y2="2160" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.components.home.background.fade}"/>
      <stop offset="1" stop-color="${theme.components.home.background.fade}" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="highlight" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1920 2160) rotate(90) scale(684.5 3891.29)">
      <stop stop-color="${theme.components.home.background.highlight}"/>
      <stop offset="1" stop-color="${theme.components.home.background.highlight}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="right" x1="3728.97" y1="41.797" x2="2775.64" y2="1368.31" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.components.home.background.right}"/>
      <stop offset="1" stop-color="${theme.components.home.background.right}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="left" x1="-18.9569" y1="14.831" x2="884.72" y2="850.544" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.components.home.background.left}"/>
      <stop offset="1" stop-color="${theme.components.home.background.left}" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>
`;
}
