import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getNavSubTitle, getNavTitle } from '../components/NavBar/navBarItem-translations';

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
  },
});

export const { setStarred, updateDashboardName } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
