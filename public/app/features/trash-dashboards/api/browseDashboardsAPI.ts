import { browseDashboardsAPI, DeleteItemsArgs } from '../../browse-dashboards/api/browseDashboardsAPI';
import { refreshParents } from '../../browse-dashboards/state';

const trashDashboardsAPI = browseDashboardsAPI.injectEndpoints({
  endpoints: (builder) => ({
    hardDeleteItems: builder.mutation<void, DeleteItemsArgs>({
      queryFn: async ({ selectedItems }, _api, _extraOptions, baseQuery) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        // Delete all the folders sequentially
        // TODO error handling here
        for (const folderUID of selectedFolders) {
          await baseQuery({
            url: `/folders/${folderUID}/trash`,
            method: 'DELETE',
            params: {
              forceDeleteRules: true,
            },
          });
        }

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
      onQueryStarted: ({ selectedItems }, { queryFulfilled, dispatch }) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        queryFulfilled.then(() => {
          dispatch(refreshParents([...selectedFolders, ...selectedDashboards]));
        });
      },
    }),
    restoreItems: builder.mutation<void, DeleteItemsArgs>({
      query: () => ({
        url: '',
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useHardDeleteItemsMutation, useRestoreItemsMutation } = trashDashboardsAPI;
