import { ServiceaccountsState } from 'app/types';

export const getServiceaccounts = (state: ServiceaccountsState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.serviceaccounts.filter((serviceaccount) => {
    return regex.test(serviceaccount.login) || regex.test(serviceaccount.email) || regex.test(serviceaccount.name);
  });
};

export const getserviceaccountsSearchQuery = (state: ServiceaccountsState) => state.searchQuery;
export const getserviceaccountsSearchPage = (state: ServiceaccountsState) => state.searchPage;
