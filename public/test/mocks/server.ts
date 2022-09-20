import { setupServer } from 'msw/node';

// This configures a request mocking server with the given request handlers.
export const server = setupServer();
