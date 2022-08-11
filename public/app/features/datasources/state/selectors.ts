import { createSelector } from '@reduxjs/toolkit';

import { StoreState } from 'app/types';

import { RequestStatus } from '../types';

import { entityAdapter } from './reducer';

export const selectRoot = (state: StoreState) => state.dataSources;

export const selectItems = createSelector(selectRoot, ({ items }) => items);

export const selectSearchQuery = createSelector(selectRoot, ({ settings }) => settings.searchQuery);

export const selectLayoutMode = createSelector(selectRoot, ({ settings }) => settings.layoutMode);

export const selectCount = createSelector(selectItems, (items) => Object.keys(items).length);

export const { selectAll, selectById } = entityAdapter.getSelectors(selectItems);

export const selectFiltered = createSelector(selectAll, selectSearchQuery, (dataSources, searchQuery = '') => {
  const regex = new RegExp(searchQuery, 'i');

  return dataSources.filter(({ name, type, database }) => regex.test(name) || regex.test(database) || regex.test(type));
});

export const selectByName = (name: string) =>
  createSelector(selectItems, (items) =>
    Object.values(items).find((ds) => ds.name.toLowerCase() === name.toLowerCase())
  );

// The following selectors are used to get information about the outstanding or completed network requests.
export const selectRequest = (actionType: string) =>
  createSelector(selectRoot, ({ requests = {} }) => requests[actionType]);

export const selectIsRequestPending = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) => request?.status === RequestStatus.Pending);

export const selectRequestError = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) =>
    request?.status === RequestStatus.Rejected ? request?.error : null
  );

export const selectIsRequestNotFetched = (actionType: string) =>
  createSelector(selectRequest(actionType), (request) => request === undefined);
