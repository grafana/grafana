import { browseDashboardsAPI, DeleteItemsArgs } from '../../browse-dashboards/api/browseDashboardsAPI';

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
