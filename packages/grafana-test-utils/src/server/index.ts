import { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

import allHandlers from '../handlers/all-handlers';

const server = setupServer(...allHandlers);

/**
 * Sets up `afterEach`, `beforeAll` and `afterAll` hooks for mock Grafana API server
 */
export function setupMockServer(
  /**
   * Additional handlers to add to server initialisation. Handlers will be `.use`d in a `beforeEach` hook
   */
  additionalHandlers?: HttpHandler[]
) {
  if (additionalHandlers) {
    beforeEach(() => {
      server.use(...additionalHandlers);
    });
  }

  afterEach(() => {
    server.resetHandlers();
  });

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  return server;
}

export default server;
