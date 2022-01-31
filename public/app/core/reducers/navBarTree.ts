import { createSlice } from '@reduxjs/toolkit';
import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';

export const initialState: NavModelItem[] = config.bootData.navTree;

const navTreeSlice = createSlice({
  name: 'navBarTree',
  initialState,
  reducers: {},
});

export const {} = navTreeSlice.actions;

export const navTreeReducer = navTreeSlice.reducer;
