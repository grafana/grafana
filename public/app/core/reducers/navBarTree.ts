import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';
import { DashboardModel } from 'app/features/dashboard/state';

export const initialState: NavModelItem[] = config.bootData?.navTree;

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
  reducers: {
    setStarred: (state, action: PayloadAction<{ dashboard: DashboardModel; isStarred: boolean }>) => {
      const starredItems = state.find((navItem) => navItem.id === 'starred');
      const { dashboard, isStarred } = action.payload;
      if (isStarred) {
        const newStarredItem: NavModelItem = {
          id: dashboard.uid,
          text: dashboard.title,
          url: dashboard.meta.url,
        };
        starredItems?.children?.push(newStarredItem);
      } else {
        const index = starredItems?.children?.findIndex((item) => item.id === dashboard.uid) ?? -1;
        if (index > -1) {
          starredItems?.children?.splice(index, 1);
        }
      }
    },
  },
});

export const { setStarred } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
