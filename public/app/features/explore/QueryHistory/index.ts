import { addEnterpriseProviders } from 'app/AppWrapper';

import { QueryHistoryContextProvider } from './QueryHistoryContextProvider';

export function initQueryHistory() {
  addEnterpriseProviders(QueryHistoryContextProvider);
}
