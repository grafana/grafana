import { setupServer } from 'msw/node';

import alertingHandlers from '../handlers/alerting';
import allHandlers from '../handlers/all-handlers';

const server = setupServer(...allHandlers, ...alertingHandlers);

/**
 * Sets up `afterEach`, `beforeAll` and `afterAll` hooks for mock Grafana API server
 */
export function setupMockServer() {
  afterEach(() => {
    server.resetHandlers();
  });

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });
}

export default server;
