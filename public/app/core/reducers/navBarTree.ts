import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';

export const initialState: NavModelItem[] = config.bootData?.navTree ?? [];

function translateNav(navTree: NavModelItem[]): NavModelItem[] {
  return navTree.map((navItem) => {
    const children = navItem.children && translateNav(navItem.children);

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
          starredItems.children.sort((a, b) => a.text.localeCompare(b.text));
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
          bookmarks.children = bookmarks.children?.filter((i) => i.id !== item.id) ?? [];
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
          starredItems.children?.sort((a, b) => a.text.localeCompare(b.text));
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
