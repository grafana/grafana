import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { type Team } from 'app/types/teams';

/**
 * Fetches the current user's team memberships once.
 * Teams change at login granularity so there is no polling.
 */
export function useUserTeams() {
  return useAsync(() => getBackendSrv().get<Team[]>('/api/user/teams'), []);
}
