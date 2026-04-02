import { setBackendSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { MockGrafanaLiveSrv } from './MockGrafanaLiveSrv';

export { MockGrafanaLiveSrv } from './MockGrafanaLiveSrv';

// Module-level singleton is safe: Jest runs each test file in its own worker.
let mockLiveSrv: MockGrafanaLiveSrv;

/**
 * Returns the current MockGrafanaLiveSrv instance.
 * Use this to emit watch events or errors in tests:
 *
 * ```ts
 * getMockLiveSrv().emitWatchEvent('jobs', { type: 'MODIFIED', object: job });
 * getMockLiveSrv().emitWatchError('repositories', new Error('connection lost'));
 * ```
 */
export function getMockLiveSrv(): MockGrafanaLiveSrv {
  return mockLiveSrv;
}

export function setupProvisioningMswServer() {
  const server = setupMockServer();

  mockLiveSrv = new MockGrafanaLiveSrv();

  setBackendSrv(backendSrv);
  setGrafanaLiveSrv(mockLiveSrv);

  afterEach(() => {
    mockLiveSrv.reset();
  });

  return server;
}
