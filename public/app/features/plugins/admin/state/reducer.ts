import { createSlice, createEntityAdapter, EntityState, AnyAction } from '@reduxjs/toolkit';
import { fetchAll, fetchDetails } from './actions';
import { CatalogPlugin, RequestInfo, RequestStatus } from '../types';
import { STATE_PREFIX } from '../constants';

type ReducerState = {
  items: EntityState<CatalogPlugin>;
  requests: Record<string, RequestInfo>;
};

export const pluginsAdapter = createEntityAdapter<CatalogPlugin>();

const isPendingRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/pending`).test(action.type);

const isFulfilledRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/fulfilled`).test(action.type);

const isRejectedRequest = (action: AnyAction) => new RegExp(`${STATE_PREFIX}\/(.*)\/rejected`).test(action.type);

// Extract the trailing '/pending', '/rejected', or '/fulfilled'
const getOriginalActionType = (type: string) => {
  const separator = type.lastIndexOf('/');

  return type.substring(0, separator);
};

export const { reducer } = createSlice({
  name: 'plugins',
  initialState: { items: pluginsAdapter.getInitialState(), requests: {} } as ReducerState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      // Fetch All
      .addCase(fetchAll.fulfilled, (state, action) => {
        pluginsAdapter.upsertMany(state.items, action.payload);
      })
      // Fetch Details
      .addCase(fetchDetails.fulfilled, (state, action) => {
        pluginsAdapter.updateOne(state.items, action.payload);
      })
      // Install
      // .addCase(install.fulfilled, (state, action) => {
      //   pluginsAdapter.upsertOne(state, action.payload);
      // })
      // Uninstall
      // .addCase(uninstall.fulfilled, (state, action) => {
      //   pluginsAdapter.upsertOne(state, action.payload);
      // }),
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
