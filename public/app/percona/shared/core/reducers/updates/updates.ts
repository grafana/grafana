import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { UpdatesService } from 'app/percona/shared/services/updates';

import {
  CheckUpdatesChangelogsPayload,
  CheckUpdatesPayload,
  SnoozePayloadBody,
  SnoozePayloadResponse,
  UpdatesState,
} from './updates.types';
import { responseToPayload } from './updates.utils';

const initialState: UpdatesState = {
  isLoading: false,
};

export const updatesSlice = createSlice({
  name: 'updates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(checkUpdatesAction.pending, (state) => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(checkUpdatesAction.fulfilled, (state, { payload }) => ({
      ...state,
      ...payload,
      updateAvailable: true, // to remove
      latest: { version: '3.0.1' }, // to remove
      isLoading: false,
    }));

    builder.addCase(checkUpdatesAction.rejected, (state) => ({
      ...initialState,
      isLoading: false,
    }));
    builder.addCase(checkUpdatesChangelogs.pending, (state) => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(checkUpdatesChangelogs.fulfilled, (state, { payload }) => ({
      ...state,
      isLoading: false,
      changeLogs: payload,
    }));

    builder.addCase(checkUpdatesChangelogs.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));
    builder.addCase(getSnoozeCurrentVersion.pending, (state) => ({
      ...state,
      isLoading: true,
    }));

    builder.addCase(getSnoozeCurrentVersion.fulfilled, (state, { payload }) => ({
      ...state,
      snoozeCurrentVersion: payload,
      isLoading: false,
    }));

    builder.addCase(getSnoozeCurrentVersion.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));
    builder.addCase(setSnoozeCurrentUpdate.pending, (state) => ({
      ...state,
      isLoading: true,
    }));

    builder.addCase(setSnoozeCurrentUpdate.fulfilled, (state, { payload }) => ({
      ...state,
      snoozeCurrentVersion: payload,
      isLoading: false,
    }));

    builder.addCase(setSnoozeCurrentUpdate.rejected, (state) => ({
      ...state,
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

export const checkUpdatesChangelogs = createAsyncThunk(
  'percona/checkUpdatesChangelogs',
  async (): Promise<CheckUpdatesChangelogsPayload> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.getUpdatesChangelogs();
      })()
    )
);

export const setSnoozeCurrentUpdate = createAsyncThunk(
  'percona/setSnoozeCurrentUpdate',
  async (body: SnoozePayloadBody): Promise<SnoozePayloadResponse> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.setSnoozeCurrentVersion(body);
      })()
    )
);

export const getSnoozeCurrentVersion = createAsyncThunk(
  'percona/getSnoozeCurrentVersion',
  async (): Promise<SnoozePayloadResponse> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.getSnoozeCurrentVersion();
      })()
    )
);

export default updatesSlice.reducer;
