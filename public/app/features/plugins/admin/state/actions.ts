import { createAsyncThunk } from '@reduxjs/toolkit';
import { getCatalogPlugins, getCatalogPlugin } from '../api';
import { STATE_PREFIX } from '../constants';

export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    return await getCatalogPlugins();
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchSingle = createAsyncThunk(`${STATE_PREFIX}/fetchSingle`, async (id: string, thunkApi) => {
  try {
    return await getCatalogPlugin(id);
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const install = createAsyncThunk(`${STATE_PREFIX}/install`, async (id: string, thunkApi) => {
  try {
    // call the install plugin API
    // return response;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const uninstall = createAsyncThunk(`${STATE_PREFIX}/uninstall`, async (id: string, thunkApi) => {
  try {
    // call the uninstall plugin API
    // return response;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});
