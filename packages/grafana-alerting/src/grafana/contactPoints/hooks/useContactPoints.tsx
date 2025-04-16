import { OverrideProperties } from 'type-fest';

import { alertingAPI } from '@grafana/alerting';
import { config } from '@grafana/runtime';

import { EnhancedListReceiverResponse } from '../types';

const { namespace } = config;

/**
 * Enhanced hook that returns ContactPoints query result
 * with properly typed data.items as ContactPoint[]
 */
function useListContactPoints() {
  const result = alertingAPI.endpoints.listReceiver.useQuery({
    namespace,
  });

  // ⚠️ dangerous type casting here, but we need to do it because the API response types is too wide and we need to narrow it down
  return result as OverrideProperties<
    typeof result,
    {
      data?: EnhancedListReceiverResponse;
      currentData?: EnhancedListReceiverResponse;
    }
  >;
}

export { useListContactPoints };
