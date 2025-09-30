import { handleRequestError } from '@grafana/api-clients';
import { cloudMigrationAPI as generatedAPI } from '@grafana/api-clients/migrate-to-cloud';
import { getLocalPlugins } from 'app/features/plugins/admin/api';
import { LocalPlugin } from 'app/features/plugins/admin/types';

export const cloudMigrationAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    // Manually written because the Swagger specifications for the plugins endpoint do not exist
    getLocalPluginList: build.query<LocalPlugin[], void>({
      queryFn: async () => {
        try {
          const list = await getLocalPlugins();
          return { data: list };
        } catch (error) {
          return handleRequestError(error);
        }
      },
    }),
  }),
});

export const { useGetLocalPluginListQuery } = cloudMigrationAPI;
