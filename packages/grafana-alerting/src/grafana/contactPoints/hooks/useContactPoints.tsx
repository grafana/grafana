import { config } from '@grafana/runtime';

import { alertingAPI } from '../../api.gen';

const { namespace } = config;

/**
 * useListContactPoints is a hook that fetches a list of contact points
 *
 * This function wraps the alertingAPI.useListReceiverQuery with proper typing
 * to ensure that the returned ContactPoints are correctly typed in the data.items array.
 *
 * It automatically uses the configured namespace for the query.
 */
function useListContactPoints() {
  return alertingAPI.useListReceiverQuery({ namespace });
}

export { useListContactPoints };
