export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as dashboardAPI } from '../../dashboard/v0alpha1';

import { generatedAPI as rawAPI } from './endpoints.gen';

const invalidateDashboardSearch = {
  onQueryStarted: (
    _arg: unknown,
    { dispatch, queryFulfilled }: { dispatch: (action: unknown) => void; queryFulfilled: Promise<unknown> }
  ) => {
    queryFulfilled.then(() => {
      dispatch(dashboardAPI.util.invalidateTags(['Search']));
    });
  },
};

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  endpoints: {
    createFolder: invalidateDashboardSearch,
    deletecollectionFolder: invalidateDashboardSearch,
    replaceFolder: invalidateDashboardSearch,
    deleteFolder: invalidateDashboardSearch,
    updateFolder: invalidateDashboardSearch,
  },
});
