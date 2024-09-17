import { ApiKeysState } from 'app/types';

export const getApiKeysCount = (state: ApiKeysState) =>
  state.includeExpired ? state.keysIncludingExpired.length : state.keys.length;

export const getApiKeys = (state: ApiKeysState) => {
  const regex = RegExp(state.searchQuery, 'i');
  const keysToFilter = state.includeExpired ? state.keysIncludingExpired : state.keys;

  return keysToFilter.filter((key) => {
    return regex.test(key.name) || regex.test(key.role);
  });
};

export const getIncludeExpired = (state: ApiKeysState) => state.includeExpired;

export const getIncludeExpiredDisabled = (state: ApiKeysState) =>
  state.keys.length === 0 && state.keysIncludingExpired.length > 0;
