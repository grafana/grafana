import { useLocation } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { useSelector } from 'app/types/store';

import { logWarning } from '../Analytics';

export type TabExtensionNav<Url extends string> = Pick<NavModelItem, 'id' | 'text' | 'icon' | 'tabSuffix'> & {
  url: Url;
};

/**
 * Creates a registry that lets code compiled into the core bundle (e.g. Grafana Enterprise)
 * register extra tabs under an alerting nav section. Tabs are keyed by url; registering the
 * same url twice is ignored.
 * @param parentNavId - The navIndex id of the nav section the tabs belong to
 */
export function createTabExtensionRegistry<Url extends string>(parentNavId: string) {
  const tabExtensions: Map<Url, { nav: TabExtensionNav<Url> }> = new Map();

  /**
   * Registers a new tab. The tab nav must have a unique url.
   * Returns a function that unregisters the tab.
   */
  function addTab(tabNav: TabExtensionNav<Url>) {
    if (tabExtensions.has(tabNav.url)) {
      logWarning('Unable to add tab extension, tab must have a unique url', { parentNavId, url: tabNav.url });
      return () => undefined;
    }
    tabExtensions.set(tabNav.url, { nav: tabNav });

    return () => {
      tabExtensions.delete(tabNav.url);
    };
  }

  /**
   * Returns the navigation configuration for all registered extension tabs.
   */
  function useExtensionTabs(): NavModelItem[] {
    const location = useLocation();

    const navIndex = useSelector((state) => state.navIndex);
    const parentNav = navIndex[parentNavId];

    return Array.from(tabExtensions.entries()).map(([url, { nav }]) => ({
      ...nav,
      active: location.pathname === url,
      url,
      parentItem: parentNav,
    }));
  }

  return { addTab, useExtensionTabs };
}
