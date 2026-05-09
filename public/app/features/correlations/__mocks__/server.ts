import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { resetFixtures } from './fixtures';

export function setupCorrelationsMswServer() {
  const server = setupMockServer();

  setBackendSrv(backendSrv);

  beforeEach(() => {
    resetFixtures();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
