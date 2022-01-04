import { ServiceAccountsState } from 'app/types';

export const getServiceAccounts = (state: ServiceAccountsState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.serviceAccounts.filter((serviceaccount) => {
    return regex.test(serviceaccount.login) || regex.test(serviceaccount.email) || regex.test(serviceaccount.name);
  });
};

export const getServiceAccountsSearchQuery = (state: ServiceAccountsState) => state.searchQuery;
export const getServiceAccountsSearchPage = (state: ServiceAccountsState) => state.searchPage;
