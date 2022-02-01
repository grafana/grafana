import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';

const defaultPins = ['home', 'dashboards', 'explore', 'alerting'].join(',');
const storedPins = (window.localStorage.getItem('pinnedNavItems') ?? defaultPins).split(',');
export const initialState: NavModelItem[] = (config.bootData.navTree as NavModelItem[]).map((n: NavModelItem) => ({
  ...n,
  showInNavBar: n.id ? storedPins.includes(n.id) : false,
}));

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
  reducers: {
    togglePin: (state: NavModelItem[], action: PayloadAction<{ id: string }>) => {
      const newState = cloneDeep(state);
      const navItemIndex = state.findIndex((navItem) => navItem.id === action.payload.id);
      newState[navItemIndex].showInNavBar = !newState[navItemIndex].showInNavBar;
      window.localStorage.setItem(
        'pinnedNavItems',
        newState
          .filter((n) => n.showInNavBar)
          .map((n) => n.id)
          .join(',')
      );

      return newState;
    },
  },
});

export const { togglePin } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
