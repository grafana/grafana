import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';

export const initialState: NavModelItem[] = config.bootData.navTree;

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
  reducers: {
    togglePin: (state: NavModelItem[], action: PayloadAction<{ id: string }>) => {
      const newState = cloneDeep(state);
      const navItemIndex = state.findIndex((navItem) => navItem.id === action.payload.id);
      newState[navItemIndex].pinned = !newState[navItemIndex].pinned;

      return newState;
    },
  },
});

export const { togglePin } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
