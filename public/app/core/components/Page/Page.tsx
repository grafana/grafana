import { css, cx } from '@emotion/css';
import { useLayoutEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import NativeScrollbar from '../NativeScrollbar';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { PageType } from './types';
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

  // PR TODO: I removed:
  // - `divId="page-scrollbar"` which is apparently used by the image renderer to scroll through the dashboard
  // - NativeScrollbar which is used for a page scroll api
  // - Canvas page background

  if (layout === PageLayoutType.Custom) {
    return (
      <div className={cx(styles.wrapper, className)} {...otherProps}>
        {children}
      </div>
    );
  }

  return (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
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

      {children}
    </div>
  );
};

Page.Contents = PageContents;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'Page-wrapper',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      position: 'relative',

      // originally from pageInner
      background: theme.colors.background.primary,
      padding: theme.spacing(2),

      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4),
      },
    }),
    pageContent: css({
      label: 'Page-content',
      flexGrow: 1,
    }),
    primaryBg: css({
      background: theme.colors.background.primary,
    }),
    pageInner: css({
      label: 'Page-inner',
      padding: theme.spacing(2),
      borderBottom: 'none',
      background: theme.colors.background.primary,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      margin: theme.spacing(0, 0, 0, 0),

      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(4),
      },
    }),
    canvasContent: css({
      label: 'Page-canvasContent',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
  };
};
