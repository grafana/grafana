import { api } from 'app/percona/shared/helpers/api';

import { ConnectRequest } from './types';

export const PlatformService = {
  connect(body: ConnectRequest): Promise<void> {
    return api.post<void, ConnectRequest>('/v1/platform:connect', body, true);
  },
  disconnect(): Promise<void> {
    return api.post<void, Object>('/v1/platform:disconnect', {});
  },
  forceDisconnect(): Promise<void> {
    return api.post<void, Object>('/v1/platform:disconnect', { force: true }, true);
  },
  getServerInfo(): Promise<{ pmm_server_id: string; pmm_server_name: string; pmm_server_telemetry_id: string }> {
    return api.get(`/v1/platform/server`, true);
  },
};
