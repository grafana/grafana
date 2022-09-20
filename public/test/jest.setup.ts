import 'whatwg-fetch';
import { server } from './mocks/server';

// enable API mocking in test runs using the same request handlers
// as for the client-side mocking.
beforeAll(() => {
  console.log('está andando bien');
  server.listen({ onUnhandledRequest: 'error' });
});
afterAll(() => {
  console.log('after all');
  server.close();
});
afterEach(() => {
  console.log('after each');
  server.resetHandlers();
});
