import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { UpdatesService } from 'app/percona/shared/services/updates';

import { CheckUpdatesPayload, UpdatesState } from './updates.types';
import { responseToPayload } from './updates.utils';

const initialState: UpdatesState = {
  isLoading: false,
};

export const updatesSlice = createSlice({
  name: 'updates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(checkUpdatesAction.pending, () => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(checkUpdatesAction.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
      isLoading: false,
    }));

    builder.addCase(checkUpdatesAction.rejected, () => ({
      ...initialState,
      isLoading: false,
    }));
  },
});

export const checkUpdatesAction = createAsyncThunk('percona/checkUpdates', async (): Promise<CheckUpdatesPayload> => {
  try {
    const res = await UpdatesService.getCurrentVersion({ force: true });
    return responseToPayload(res);
  } catch (error) {
    const res = await UpdatesService.getCurrentVersion({ force: true, only_installed_version: true });
    return responseToPayload(res);
  }
});

export default updatesSlice.reducer;
