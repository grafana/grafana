import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';

const defaultPins = ((config.bootData?.navTree as NavModelItem[]) ?? []).map((n) => n.id).join(',');
const storedPins = (window.localStorage.getItem('pinnedNavItems') ?? defaultPins).split(',');

export const initialState: NavModelItem[] = ((config.bootData?.navTree ?? []) as NavModelItem[]).map(
  (n: NavModelItem) => ({
    ...n,
    hideFromNavbar: n.id === undefined || !storedPins.includes(n.id),
  })
);

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
  reducers: {
    togglePin: (state, action: PayloadAction<{ id: string }>) => {
      const navItemIndex = state.findIndex((navItem) => navItem.id === action.payload.id);
      state[navItemIndex].hideFromNavbar = !state[navItemIndex].hideFromNavbar;
      window.localStorage.setItem(
        'pinnedNavItems',
        state
          .filter((n) => !n.hideFromNavbar)
          .map((n) => n.id)
          .join(',')
      );
    },
  },
});

export const { togglePin } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
