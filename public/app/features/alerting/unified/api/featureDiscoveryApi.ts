import { RulerDataSourceConfig } from 'app/types/unified-alerting';

import { AlertmanagerApiFeatures, PromApplication } from '../../../../types/unified-alerting-dto';
import { withPerformanceLogging } from '../Analytics';
import { getRulesDataSource } from '../utils/datasource';

import { alertingApi } from './alertingApi';
import { discoverAlertmanagerFeatures, discoverFeatures } from './buildInfo';

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

    discoverDsFeatures: build.query<{ rulerConfig?: RulerDataSourceConfig }, { rulesSourceName: string }>({
      queryFn: async ({ rulesSourceName }) => {
        const dsSettings = getRulesDataSource(rulesSourceName);
        if (!dsSettings) {
          return { error: new Error(`Missing data source configuration for ${rulesSourceName}`) };
        }

        const discoverFeaturesWithLogging = withPerformanceLogging(
          'unifiedalerting/featureDiscoveryApi/discoverDsFeatures',
          discoverFeatures,
          {
            dataSourceName: rulesSourceName,
            endpoint: 'unifiedalerting/featureDiscoveryApi/discoverDsFeatures',
          }
        );

        const dsFeatures = await discoverFeaturesWithLogging(dsSettings.name);

        const rulerConfig: RulerDataSourceConfig | undefined = dsFeatures.features.rulerApiEnabled
          ? {
              dataSourceName: dsSettings.name,
              apiVersion: dsFeatures.application === PromApplication.Cortex ? 'legacy' : 'config',
            }
          : undefined;

        return { data: { rulerConfig } };
      },
    }),
  }),
});
