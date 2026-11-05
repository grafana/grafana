import { http, HttpResponse } from 'msw';

// Default handler for the upstream gateway's /_/status endpoint (ADR 0014).
// Tests that need a different state override this with server.use(...).
const statusHandler = () =>
  http.get('/_/status', () =>
    HttpResponse.json(
      { status: 'active' },
      {
        headers: {
          'cache-control': 'no-store',
        },
      }
    )
  );

const handlers = [statusHandler()];

export default handlers;
