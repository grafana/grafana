export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
export { folderAPIVersionResolver, getFolderAPIBaseURL, type FolderAPIVersion } from './folderApiVersionResolver';
import { generatedAPI as dashboardAPI } from '../../dashboard/v0alpha1';

import { generatedAPI as rawAPI } from './endpoints.gen';

const invalidateDashboardSearch = {
  onQueryStarted: async (
    _arg: unknown,
    { dispatch, queryFulfilled }: { dispatch: (action: unknown) => void; queryFulfilled: Promise<unknown> }
  ) => {
    try {
      await queryFulfilled;
    } catch (e) {
      return;
    }
    dispatch(dashboardAPI.util.invalidateTags(['Search']));
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
