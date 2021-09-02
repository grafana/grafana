import { createAsyncThunk, Update } from '@reduxjs/toolkit';
import { getCatalogPlugins, getPluginDetails } from '../api';
import { STATE_PREFIX } from '../constants';
import { CatalogPlugin } from '../types';

export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, async (_, thunkApi) => {
  try {
    return await getCatalogPlugins();
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchDetails = createAsyncThunk(`${STATE_PREFIX}/fetchDetails`, async (id: string, thunkApi) => {
  try {
    const details = await getPluginDetails(id);

    return {
      id,
      changes: { details },
    } as Update<CatalogPlugin>;
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
