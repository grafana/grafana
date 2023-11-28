import { __awaiter } from "tslib";
import { PromApplication } from '../../../../types/unified-alerting-dto';
import { withPerformanceLogging } from '../Analytics';
import { getRulesDataSource } from '../utils/datasource';
import { alertingApi } from './alertingApi';
import { discoverAlertmanagerFeatures, discoverFeatures } from './buildInfo';
export const featureDiscoveryApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        discoverAmFeatures: build.query({
            queryFn: ({ amSourceName }) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const amFeatures = yield discoverAlertmanagerFeatures(amSourceName);
                    return { data: amFeatures };
                }
                catch (error) {
                    return { error: error };
                }
            }),
        }),
        discoverDsFeatures: build.query({
            queryFn: ({ rulesSourceName }) => __awaiter(void 0, void 0, void 0, function* () {
                const dsSettings = getRulesDataSource(rulesSourceName);
                if (!dsSettings) {
                    return { error: new Error(`Missing data source configuration for ${rulesSourceName}`) };
                }
                const discoverFeaturesWithLogging = withPerformanceLogging(discoverFeatures, `[${rulesSourceName}] Rules source features discovered`, {
                    dataSourceName: rulesSourceName,
                    endpoint: 'unifiedalerting/featureDiscoveryApi/discoverDsFeatures',
                });
                const dsFeatures = yield discoverFeaturesWithLogging(dsSettings.name);
                const rulerConfig = dsFeatures.features.rulerApiEnabled
                    ? {
                        dataSourceName: dsSettings.name,
                        apiVersion: dsFeatures.application === PromApplication.Cortex ? 'legacy' : 'config',
                    }
                    : undefined;
                return { data: { rulerConfig } };
            }),
        }),
    }),
});
//# sourceMappingURL=featureDiscoveryApi.js.map