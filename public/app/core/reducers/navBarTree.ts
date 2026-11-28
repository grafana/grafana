import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type NavModelItem } from '@grafana/data';

import { getInitialNavTree } from '../navtree/buildNavTree';
import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';

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

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState: () => translateNav(getInitialNavTree()),
  reducers: {
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
    removePluginFromNavTree: (state, action: PayloadAction<{ pluginID: string }>) => {
      const navID = 'plugin-page-' + action.payload.pluginID;
      const pluginItemIndex = state.findIndex((navItem) => navItem.id === navID);
      if (pluginItemIndex > -1) {
        state.splice(pluginItemIndex, 1);
      }
    },
  },
});

export const { removePluginFromNavTree, setBookmark } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
