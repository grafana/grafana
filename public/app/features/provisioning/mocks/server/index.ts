import { NEVER } from 'rxjs';

import { setBackendSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

export function setupProvisioningMswServer() {
  const server = setupMockServer();

  setBackendSrv(backendSrv);
  // Provide a minimal GrafanaLiveSrv mock so that onCacheEntryAdded watch
  // subscriptions (triggered by RTK Query list endpoints with watch: true)
  // don't crash when calling getGrafanaLiveSrv().getStream().
  setGrafanaLiveSrv({
    getConnectionState: () => NEVER,
    getStream: () => NEVER,
    getDataStream: () => NEVER,
    getPresence: () => Promise.resolve({} as never),
    publish: () => Promise.resolve(undefined),
  });

  return server;
}
