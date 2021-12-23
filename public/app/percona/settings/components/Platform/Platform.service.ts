import { api } from 'app/percona/shared/helpers/api';
import { ConnectRequest } from './types';

export const PlatformService = {
  connect(body: ConnectRequest): Promise<void> {
    return api.post<void, ConnectRequest>('/v1/Platform/Connect', body);
  },
  disconnect(): Promise<void> {
    return api.post<void, Object>('/v1/Platform/Disconnect', {});
  },
};
