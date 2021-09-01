import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import { fetchAll, fetchSingle, install, uninstall } from './actions';

export const pluginsAdapter = createEntityAdapter();

export const { reducer } = createSlice({
  name: 'plugins',
  initialState: {
    items: pluginsAdapter.getInitialState({}),
  },
  reducers: {},
  extraReducers: (builder) =>
    builder
      // Fetch All
      .addCase(fetchAll.fulfilled, (state, action) => {
        pluginsAdapter.upsertMany(state, action.payload);
      })
      // Fetch Single
      .addCase(fetchSingle.fulfilled, (state, action) => {
        pluginsAdapter.upsertOne(state, action.payload);
      })
      // Install
      .addCase(install.fulfilled, (state, action) => {
        pluginsAdapter.upsertOne(state, action.payload);
      })
      // Uninstall
      .addCase(uninstall.fulfilled, (state, action) => {
        pluginsAdapter.upsertOne(state, action.payload);
      }),
  // TODO<add error handling>
});
