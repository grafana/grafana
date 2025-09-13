import { css, cx } from '@emotion/css';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { TOP_BAR_LEVEL_HEIGHT } from '../AppChrome/types';
import NativeScrollbar from '../NativeScrollbar';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { PageToolbarActions } from './PageToolbarActions';
import { PageType } from './types';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';

export interface PageContextType {
  setToolbar: Dispatch<SetStateAction<ReactNode>>;
}

export const PageContext = createContext<PageContextType | undefined>(undefined);

function usePageContext(): PageContextType {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('No PageContext found');
  }
  return context;
}

/**
 * Hook to dynamically set the toolbar of a Page from a child component.
 * Prefer setting the toolbar directly as a prop to Page.
 * @param toolbar a ReactNode that will be rendered in a second toolbar
 */
export function usePageToolbar(toolbar?: ReactNode) {
  const { setToolbar } = usePageContext();
  useEffect(() => {
    setToolbar(toolbar);
    return () => setToolbar(undefined);
  }, [setToolbar, toolbar]);
}

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
  toolbar: toolbarProp,
  info,
  layout = PageLayoutType.Standard,
  onSetScrollRef,
  ...otherProps
}) => {
  const isSingleTopNav = config.featureToggles.singleTopNav;
  const [toolbar, setToolbar] = useState(toolbarProp);
  const styles = useStyles2(getStyles, Boolean(isSingleTopNav && toolbar));
  const navModel = usePageNav(navId, oldNavProp);
  const { chrome } = useGrafana();

  // Cleanup toolbar state on unmount
  useEffect(() => {
    return () => {
      setToolbar(undefined);
    };
  }, []);

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

  return (
    <PageContext.Provider value={{ setToolbar }}>
      <div id={`page-${navId}`} className={cx(styles.wrapper, className)} {...otherProps}>
        {isSingleTopNav && toolbar && <PageToolbarActions>{toolbar}</PageToolbarActions>}
        {layout === PageLayoutType.Standard && (
          <NativeScrollbar
            // This id is used by the image renderer to scroll through the dashboard
            divId="page-scrollbar"
            onSetScrollRef={onSetScrollRef}
          >
            <div className={styles.pageInner}>
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
    </PageContext.Provider>
  );
};

Page.Contents = PageContents;

const getStyles = (theme: GrafanaTheme2, hasToolbar: boolean) => {
  return {
    wrapper: css({
      label: 'page-wrapper',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      marginTop: hasToolbar ? TOP_BAR_LEVEL_HEIGHT : 0,
      position: 'relative',
    }),
    pageContent: css({
      label: 'page-content',
      flexGrow: 1,
    }),
    primaryBg: css({
      background: theme.colors.background.primary,
    }),
    pageInner: css({
      label: 'page-inner',
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
      label: 'canvas-content-page',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
  };
};
