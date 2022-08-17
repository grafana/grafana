import { AlertmanagerApiFeatures } from '../../../../types/unified-alerting-dto';

import { alertingApi } from './alertingApi';
import { discoverAlertmanagerFeatures } from './buildInfo';

export const featureDiscoveryApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    discoverAmFeatures: build.query<AlertmanagerApiFeatures, { amSourceName: string }>({
      queryFn: async ({ amSourceName }) => {
        try {
          const amFeatures = await discoverAlertmanagerFeatures(amSourceName);
          return { data: amFeatures };
        } catch (error) {
          return { error: error };
        }
      },
    }),
  }),
});
