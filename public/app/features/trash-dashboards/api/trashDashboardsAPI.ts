import { browseDashboardsAPI, DeleteItemsArgs } from '../../browse-dashboards/api/browseDashboardsAPI';
import { refreshParents } from '../../browse-dashboards/state';

const trashDashboardsAPI = browseDashboardsAPI.injectEndpoints({
  endpoints: (builder) => ({
    hardDeleteItems: builder.mutation<void, DeleteItemsArgs>({
      queryFn: async ({ selectedItems }, _api, _extraOptions, baseQuery) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        // Delete all the dashboards sequentially
        // TODO error handling here
        for (const dashboardUID of selectedDashboards) {
          await baseQuery({
            url: `/dashboards/uid/${dashboardUID}/trash`,
            method: 'DELETE',
          });
        }
        return { data: undefined };
      },
    }),
    restoreItems: builder.mutation<void, DeleteItemsArgs>({
      queryFn: async ({ selectedItems }, _api, _extraOptions, baseQuery) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        // Delete all the dashboards sequentially
        // TODO error handling here
        for (const dashboardUID of selectedDashboards) {
          await baseQuery({
            url: `/dashboards/uid/${dashboardUID}/trash`,
            method: 'PATCH',
          });
        }
        return { data: undefined };
      },
      onQueryStarted: ({ selectedItems }, { queryFulfilled, dispatch }) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        queryFulfilled.then(() => {
          dispatch(refreshParents(selectedDashboards));
        });
      },
    }),
  }),
  overrideExisting: false,
});

export const { useHardDeleteItemsMutation, useRestoreItemsMutation } = trashDashboardsAPI;
