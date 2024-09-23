import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { UpdatesService } from 'app/percona/shared/services/updates';

import {
  CheckUpdatesChangelogsPayload,
  CheckUpdatesPayload,
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
    builder.addCase(checkUpdatesChangelogs.pending, () => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(checkUpdatesChangelogs.fulfilled, (state, { payload }) => ({
      ...state,
      isLoading: false,
      changeLogs: payload,
    }));

    builder.addCase(checkUpdatesChangelogs.rejected, () => ({
      ...initialState,
      isLoading: false,
    }));
    builder.addCase(getSnoozeCurrentUpdate.pending, () => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(getSnoozeCurrentUpdate.fulfilled, (state, { payload }) => ({
      ...state,
      snoozeCurrentVersion: payload,
      isLoading: false,
    }));

    builder.addCase(getSnoozeCurrentUpdate.rejected, () => ({
      ...initialState,
      isLoading: false,
    }));
    builder.addCase(snoozeCurrentUpdate.pending, () => ({
      ...initialState,
      isLoading: true,
    }));

    builder.addCase(snoozeCurrentUpdate.fulfilled, (state, { payload }) => ({
      ...state,
      snoozeCurrentVersion: payload,
      isLoading: false,
    }));

    builder.addCase(snoozeCurrentUpdate.rejected, () => ({
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

export const checkUpdatesChangelogs = createAsyncThunk(
  'percona/checkUpdatesChangelogs',
  async (): Promise<CheckUpdatesChangelogsPayload> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.getUpdatesChangelogs();
      })()
    )
);

export const snoozeCurrentUpdate = createAsyncThunk(
  'percona/checkUpdatesChangelogs',
  async (body): Promise<SnoozePayloadResponse> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.snoozeCurrentVersion(body);
      })()
    )
);

export const getSnoozeCurrentVersion = createAsyncThunk(
  'percona/checkUpdatesChangelogs',
  async (body): Promise<SnoozePayloadResponse> =>
    withSerializedError(
      (async () => {
        return await UpdatesService.getSnoozeCurrentVersion();
      })()
    )
);

export default updatesSlice.reducer;
