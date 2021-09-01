import { createAsyncThunk } from '@reduxjs/toolkit';
import { getCatalogPlugins } from '../api';

export const fetchAll = createAsyncThunk('plugins/fetchAll', async (_, thunkApi) => {
  try {
    return await getCatalogPlugins();
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const fetchSingle = createAsyncThunk('plugins/fetchSingle', async (id: string, thunkApi) => {
  try {
    // fetch the single plugin from the API
    // return plugin;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const install = createAsyncThunk('plugins/install', async (id: string, thunkApi) => {
  try {
    // call the install plugin API
    // return response;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});

export const uninstall = createAsyncThunk('plugins/uninstall', async (id: string, thunkApi) => {
  try {
    // call the uninstall plugin API
    // return response;
  } catch (e) {
    // TODO<add more error handling here>
    return thunkApi.rejectWithValue('Unknown error.');
  }
});
