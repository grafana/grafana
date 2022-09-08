import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { traverseMenuTree, updateExpandedState } from './navBarTree.utils';

export const initialState: NavModelItem[] = updateExpandedState(config.bootData?.navTree ?? []);

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
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
            id,
            text: title,
            url,
          };
          starredItems.children.push(newStarredItem);
          starredItems.children.sort((a, b) => a.text.localeCompare(b.text));
        } else {
          const index = starredItems.children?.findIndex((item) => item.id === id) ?? -1;
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
    // @Percona
    updateMenuTree: (state, action: PayloadAction<{ id: string; active: boolean }>) => {
      const { id, active } = action.payload;

      const nodeMap: Record<string, NavModelItem> = {};
      const parentMap: Record<string, NavModelItem> = {};

      // Close all other menu items
      traverseMenuTree(state, (item) => {
        item.expanded = false;

        item.children?.map((child) => {
          parentMap[child.id || ''] = item;
        });

        nodeMap[item.id || ''] = item;
      });

      // Expand menu tree for the currently active menu item
      let current = nodeMap[id];
      let parent = parentMap[id];

      current.expanded = active;

      while (current && parent) {
        current = parent;
        parent = parentMap[current.id || ''];

        if (current) {
          current.expanded = true;
        }
      }
    },
    updateNavTree: (_, action: PayloadAction<{ items: NavModelItem[] }>) => {
      return updateExpandedState(cloneDeep(action.payload.items));
    },
  },
});

export const { setStarred, updateDashboardName, updateMenuTree, updateNavTree } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
