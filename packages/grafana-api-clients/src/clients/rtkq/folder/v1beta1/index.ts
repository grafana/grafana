export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as dashboardAPI } from '../../dashboard/v0alpha1';

import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  endpoints: {
    createFolder: {
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => {
        queryFulfilled.then(() => {
          dispatch(dashboardAPI.util.invalidateTags(['Search']));
        });
      },
    },
    deletecollectionFolder: {
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => {
        queryFulfilled.then(() => {
          dispatch(dashboardAPI.util.invalidateTags(['Search']));
        });
      },
    },
    replaceFolder: {
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => {
        queryFulfilled.then(() => {
          dispatch(dashboardAPI.util.invalidateTags(['Search']));
        });
      },
    },
    deleteFolder: {
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => {
        queryFulfilled.then(() => {
          dispatch(dashboardAPI.util.invalidateTags(['Search']));
        });
      },
    },
    updateFolder: {
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => {
        queryFulfilled.then(() => {
          dispatch(dashboardAPI.util.invalidateTags(['Search']));
        });
      },
    },
  },
});
