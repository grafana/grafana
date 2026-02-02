import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DashFolderLinkRegexp, t } from '../internationalization';
import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';

export const initialState: NavModelItem[] = config.bootData?.navTree ?? [];

function translateNav(navTree: NavModelItem[]): NavModelItem[] {
  return navTree.map((navItem) => {
    // BMC Code Starts: Reports Localization
    if (navItem.pluginId === 'reports') {
      if (navItem.text === 'History') {
        navItem.id = 'reports/history';
      } else if (navItem.text === 'Settings') {
        navItem.id = 'reports/settings';
      } else if (navItem.text === 'Manage Ownership') {
        navItem.id = 'reports/manage-ownership';
      }
    }
    if (navItem.pluginId === 'bmc-insightfinder-app') {
      if (navItem.text === 'Configure Views') {
        navItem.id = 'insight-finder/configure-views';
      } else if (navItem.text === 'Settings') {
        navItem.id = 'insight-finder/settings';
      }
    }
    if (navItem.id?.startsWith(ID_PREFIX)) {
      const match = navItem.url?.match(DashFolderLinkRegexp);
      if (match) {
        navItem.text = t(`bmc-dynamic.${match[1]}.name`, navItem.text);
      }
    }
    // BMC Code Ends
    const children = navItem.children && translateNav(navItem.children);

    // BMC Code: Added sorting logic for starred dashboards
    if (navItem.id === 'starred' && navItem.children) {
      navItem.children.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
    }

    return {
      ...navItem,
      children: children,
      text: getNavTitle(navItem.id) ?? navItem.text,
      subTitle: getNavSubTitle(navItem.id) ?? navItem.subTitle,
      emptyMessage: getNavTitle(navItem.emptyMessageId),
    };
  });
}

// this matches the prefix set in the backend navtree
export const ID_PREFIX = 'starred/';

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState: () => translateNav(config.bootData?.navTree ?? []),
  reducers: {
    setStarred: (state, action: PayloadAction<{ id: string; title: string; url: string; isStarred: boolean }>) => {
      const starredItems = state.find((navItem) => navItem.id === 'starred');
      const { id, title, url, isStarred } = action.payload;
      if (starredItems) {
        if (isStarred) {
          if (!starredItems.children) {
            starredItems.children = [];
          }
          const newStarredItem: NavModelItem = {
            id: ID_PREFIX + id,
            text: title,
            url,
          };
          starredItems.children.push(newStarredItem);
          //BMC Code : Added toLowerCase() for case insensitive sorting
          starredItems.children.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
        } else {
          const index = starredItems.children?.findIndex((item) => item.id === ID_PREFIX + id) ?? -1;
          if (index > -1) {
            starredItems?.children?.splice(index, 1);
          }
        }
      }
    },
    setBookmark: (state, action: PayloadAction<{ item: NavModelItem; isSaved: boolean }>) => {
      if (!config.featureToggles.pinNavItems) {
        return;
      }
      const bookmarks = state.find((navItem) => navItem.id === 'bookmarks');
      const { item, isSaved } = action.payload;
      if (bookmarks) {
        if (isSaved) {
          bookmarks.children ||= [];
          const newBookmark: NavModelItem = {
            ...item,
            // Clear the children, sortWeight and empty message of the item
            children: [],
            sortWeight: 0,
            emptyMessageId: '',
            emptyMessage: '',
            parentItem: { id: bookmarks.id, text: bookmarks.text },
          };
          bookmarks.children.push(newBookmark);
        } else {
          bookmarks.children = bookmarks.children?.filter((i) => i.url !== item.url) ?? [];
        }
      }
    },
    updateDashboardName: (state, action: PayloadAction<{ id: string; title: string; url: string }>) => {
      const { id, title, url } = action.payload;
      const starredItems = state.find((navItem) => navItem.id === 'starred');
      if (starredItems) {
        const navItem = starredItems.children?.find((navItem) => navItem.id === id);
        if (navItem) {
          navItem.text = title;
          navItem.url = url;
          //BMC Code : Added toLowerCase() for case insensitive sorting
          starredItems.children?.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
        }
      }
    },
    removePluginFromNavTree: (state, action: PayloadAction<{ pluginID: string }>) => {
      const navID = 'plugin-page-' + action.payload.pluginID;
      const pluginItemIndex = state.findIndex((navItem) => navItem.id === navID);
      if (pluginItemIndex > -1) {
        state.splice(pluginItemIndex, 1);
      }
    },
  },
});

export const { setStarred, removePluginFromNavTree, updateDashboardName, setBookmark } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
