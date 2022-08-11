import { createSlice, createEntityAdapter, Reducer, AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { DataSourceSettings, LayoutMode, LayoutModes, PanelPlugin } from '@grafana/data';

import { STATE_PREFIX } from '../constants';
import { DataSourcesState, RequestStatus } from '../types';

import { fetchAll, fetchSingle, create, update, remove } from './actions';

export const entityAdapter = createEntityAdapter<DataSourceSettings>();

export const initialState: DataSourcesState = {
  items: entityAdapter.getInitialState(),
  requests: {},
  settings: {
    searchQuery: '',
    layoutMode: LayoutModes.Grid,
  },
};

const slice = createSlice({
  name: 'dataSources',
  initialState,
  reducers: {
    setLayoutMode(state, action: PayloadAction<LayoutMode>) {
      state.settings.layoutMode = action.payload;
    },
  },
  extraReducers: (builder) =>
    builder
      // Fetch All
      .addCase(fetchAll.fulfilled, (state, action) => {
        entityAdapter.upsertMany(state.items, action.payload);
      })
      // Fetch Single
      .addCase(fetchSingle.fulfilled, (state, action) => {
        entityAdapter.upsertOne(state.items, action.payload);
      })
      // Create
      .addCase(create.fulfilled, (state, action) => {
        entityAdapter.upsertOne(state.items, action.payload);
      })
      // Update
      .addCase(update.fulfilled, (state, action) => {
        entityAdapter.updateOne(state.items, { id: action.payload.id, changes: action.payload });
      })
      // Delete
      .addCase(remove.fulfilled, (state, action) => {
        entityAdapter.removeOne(state.items, action.payload);
      })
      // Request actions
      .addMatcher(isPendingRequest, (state, action) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Pending,
        };
      })
      .addMatcher(isFulfilledRequest, (state, action) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Fulfilled,
        };
      })
      .addMatcher(isRejectedRequest, (state, action) => {
        state.requests[getOriginalActionType(action.type)] = {
          status: RequestStatus.Rejected,
          error: action.payload,
        };
      }),
});

export const { setLayoutMode: setDisplayMode } = slice.actions;
export const reducer: Reducer<DataSourcesState, AnyAction> = slice.reducer;

// TODO - move these to a common place
// -----------------
const isPendingRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/pending`).test(action.type);

const isFulfilledRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/fulfilled`).test(action.type);

const isRejectedRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/rejected`).test(action.type);

// Extract the trailing '/pending', '/rejected', or '/fulfilled'
const getOriginalActionType = (type: string) => {
  const separator = type.lastIndexOf('/');

  return type.substring(0, separator);
};
// -----------------
