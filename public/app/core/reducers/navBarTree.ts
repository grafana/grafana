import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type NavModelItem } from '@grafana/data';
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

export interface StarredNavItem {
  id: string;
  title: string;
  url: string;
}
// Single shared collator avoids per-call Intl.Collator construction
const collator = new Intl.Collator();

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
          starredItems.children.sort((a, b) => collator.compare(a.text, b.text));
        } else {
          const index = starredItems.children?.findIndex((item) => item.id === ID_PREFIX + id) ?? -1;
          if (index > -1) {
            starredItems?.children?.splice(index, 1);
          }
        }
      }
    },
    setBookmark: (state, action: PayloadAction<{ item: NavModelItem; isSaved: boolean }>) => {
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
        const navItem = starredItems.children?.find((navItem) => navItem.id === ID_PREFIX + id);
        if (navItem) {
          navItem.text = title;
          navItem.url = url;
          starredItems.children?.sort((a, b) => collator.compare(a.text, b.text));
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
    setStarredItems: (state, action: PayloadAction<{ uids: string[]; items: StarredNavItem[] }>) => {
      const starred = state.find((n) => n.id === 'starred');
      if (!starred) {
        return;
      }
      const { uids, items } = action.payload;
      const found = new Map(items.map((item) => [item.id, item]));
      const existing = new Map((starred.children ?? []).map((child) => [child.id, child]));
      const children: NavModelItem[] = [];
      for (const uid of uids) {
        const item = found.get(uid);
        if (item) {
          children.push({ id: ID_PREFIX + uid, text: item.title, url: item.url });
        } else {
          // A starred uid can be missing from the search response when the eventually
          // consistent index hasn't caught up with a fresh star yet, or when the dashboard
          // was deleted. Keep the already-rendered entry (e.g. the optimistic one from
          // setStarred) so a just-starred item doesn't vanish; a deleted dashboard has no
          // entry to keep and is dropped on the next full page load either way.
          const prev = existing.get(ID_PREFIX + uid);
          if (prev) {
            children.push(prev);
          }
        }
      }
      starred.children = children.sort((a, b) => collator.compare(a.text, b.text));
    },
  },
});

export const { setStarred, setStarredItems, removePluginFromNavTree, updateDashboardName, setBookmark } =
  navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
