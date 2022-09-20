import 'whatwg-fetch';
import { server } from './mocks/server';

// enable API mocking in test runs using the same request handlers
// as for the client-side mocking.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterAll(() => {
  server.close();
});
afterEach(() => {
  server.resetHandlers();
});
