export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { config } from '@grafana/runtime';

import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: ['QuotaUsage'],
  endpoints: {
    getUsage: {
      providesTags: ['QuotaUsage'],
    },
  },
});

export function invalidateQuotaUsage(dispatch: (action: unknown) => void) {
  if (!config.featureToggles.kubernetesUnifiedStorageQuotas) {
    return;
  }
  dispatch(generatedAPI.util.invalidateTags(['QuotaUsage']));
}
