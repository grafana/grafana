import { NavIndex, NavModelItem } from '@grafana/data';
import config from 'app/core/config';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export function buildInitialState(): NavIndex {
  const navIndex: NavIndex = {};
  const rootNodes = config.bootData.navTree as NavModelItem[];
  buildNavIndex(navIndex, rootNodes);
  return navIndex;
}

function buildNavIndex(navIndex: NavIndex, children: NavModelItem[], parentItem?: NavModelItem) {
  for (const node of children) {
    navIndex[node.id] = {
      ...node,
      parentItem: parentItem,
    };

    if (node.children) {
      buildNavIndex(navIndex, node.children, node);
    }
  }
}

export const initialState: NavIndex = {};

export const navIndexSlice = createSlice({
  name: 'navIndex',
  initialState,
  reducers: {
    updateNavIndex: (state, action: PayloadAction<NavModelItem>) => {
      const newPages: NavIndex = {};
      const payload = action.payload;

      for (const node of payload.children) {
        newPages[node.id] = {
          ...node,
          parentItem: payload,
        };
      }

      return { ...state, ...newPages };
    },
  },
});

export const { updateNavIndex } = navIndexSlice.actions;

export const navIndexReducer = navIndexSlice.reducer;
