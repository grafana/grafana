import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import { fetchAll, fetchSingle } from './actions';
import { CatalogPlugin } from '../types';

export const pluginsAdapter = createEntityAdapter<CatalogPlugin>();

export const { reducer } = createSlice({
  name: 'plugins',
  initialState: pluginsAdapter.getInitialState(),
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
      }),
  // Install
  // .addCase(install.fulfilled, (state, action) => {
  //   pluginsAdapter.upsertOne(state, action.payload);
  // })
  // Uninstall
  // .addCase(uninstall.fulfilled, (state, action) => {
  //   pluginsAdapter.upsertOne(state, action.payload);
  // }),
  // TODO<add error handling>
});
