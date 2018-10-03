import { ApiKeysState } from 'app/types';

export const getApiKeys = (state: ApiKeysState) => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.keys.filter(key => {
    return regex.test(key.name) || regex.test(key.role);
  });
};
