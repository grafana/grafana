import { css, cx } from '@emotion/css';
import { useLayoutEffect } from 'react';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
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
  background,
  ...otherProps
}) => {
  const styles = useStyles2(getStyles);
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

  const resolvedBg = background ?? getDefaultBackgroundForLayout(layout);

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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'page-wrapper',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      position: 'relative',
      container: 'page / inline-size',
    }),
    wrapperPrimary: css({
      label: 'page-wrapper-primary',
      background: theme.colors.background.primary,
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

function getDefaultBackgroundForLayout(layout: PageLayoutType) {
  if (layout === PageLayoutType.Standard) {
    return 'primary';
  }

  if (layout === PageLayoutType.Home) {
    return 'gradient';
  }

  return 'canvas';
}

function getGradientBackgroundForTheme(theme: GrafanaTheme2) {
  // Use an inline SVG as a background to avoid flashing of the background when loading a page
  // Use an inline SVG rather than a CSS gradient due to the complexity of the gradients being used
  return theme.isDark
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2322 1181"><path fill="url(#a)" d="M0 0h2322v1181H0z"/><path fill="url(#b)" fill-opacity=".25" d="M0 0h2322v1181H0z"/><path fill="url(#c)" fill-opacity=".2" d="M0 0h2322v1181H0z"/><path fill="#1b1b2c" fill-opacity=".4" d="M0 0h2322v1181H0z"/><defs><linearGradient id="a" x1="472.424" x2="335.969" y1="1181" y2="-57.275" gradientUnits="userSpaceOnUse"><stop stop-color="#1a1626"/><stop offset="1" stop-color="#3a364c"/></linearGradient><linearGradient id="b" x1="2254.86" x2="1752.33" y1="22.853" y2="796.185" gradientUnits="userSpaceOnUse"><stop stop-color="#722323"/><stop offset="1" stop-color="#722323" stop-opacity="0"/></linearGradient><linearGradient id="c" x1="-11.463" x2="484.016" y1="8.109" y2="514.871" gradientUnits="userSpaceOnUse"><stop stop-color="#1b6d68"/><stop offset="1" stop-color="#1b416d" stop-opacity="0"/></linearGradient></defs></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 2322 1181"><path fill="url(#a)" d="M0 0h2322v1181H0z"/><path fill="url(#b)" d="M0 0h2322v1181H0z"/><path fill="url(#c)" fill-opacity=".18" d="M0 0h2322v1181H0z"/><path fill="url(#d)" fill-opacity=".18" d="M0 0h2322v1181H0z"/><defs><linearGradient id="a" x1="472.424" x2="335.969" y1="1181" y2="-57.275" gradientUnits="userSpaceOnUse"><stop stop-color="#cbcee9"/><stop offset=".745" stop-color="#f4f2fb"/></linearGradient><linearGradient id="b" x1="862" x2="762.5" y1="1209.5" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#e3e3ec"/><stop offset="1" stop-color="#dedfee"/></linearGradient><linearGradient id="c" x1="2268.5" x2="1749.44" y1="53.5" y2="797.834" gradientUnits="userSpaceOnUse"><stop stop-color="#ff9a9a"/><stop offset="1" stop-color="#ddc8eb" stop-opacity="0"/></linearGradient><linearGradient id="d" x1="-11.463" x2="655.435" y1="8.109" y2="772.366" gradientUnits="userSpaceOnUse"><stop stop-color="#a6e3df"/><stop offset="1" stop-color="#b6e1ee" stop-opacity="0"/></linearGradient></defs></svg>`;
}
