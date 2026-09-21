import { of } from 'rxjs';

import { type EventBusExtended } from '@grafana/data';

import { BackendSrv } from '../services/backend_srv';
import { type ContextSrv } from '../services/context_srv';

describe('server-required session rotation', () => {
  beforeEach(() => {
    document.cookie = 'grafana_session_expiry=; Max-Age=0; Path=/';
  });

  afterEach(() => {
    document.cookie = 'grafana_session_expiry=; Max-Age=0; Path=/';
  });

  function setup({
    authenticatedBy = 'oauth_azuread',
    messageId = 'session.token.rotate',
    rotationStatus = 200,
    retryStatus = 200,
  } = {}) {
    const paths: string[] = [];
    const logout = jest.fn();
    let queryCount = 0;
    const fromFetch = jest.fn((input: string | Request) => {
      const path = new URL(typeof input === 'string' ? input : input.url, 'http://localhost:3000').pathname;
      paths.push(path);
      let status = 200;
      let data: object = {};
      if (path === '/api/ds/query') {
        status = queryCount++ === 0 ? 401 : retryStatus;
        data = status === 401 ? { statusCode: 401, messageId, message: 'Unauthorized' } : { results: {} };
      } else if (path === '/api/user/auth-tokens/rotate') {
        status = rotationStatus;
      } else if (path === '/api/login/ping') {
        status = 401;
      } else {
        throw new Error(`Unexpected request ${path}`);
      }
      return of({
        ok: status === 200,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Map(),
        text: () => Promise.resolve(JSON.stringify(data)),
        redirected: false,
        type: 'basic',
        url: `http://localhost:3000${path}`,
      } as unknown as Response);
    });
    const srv = new BackendSrv({
      fromFetch,
      logout,
      appEvents: { emit: jest.fn(), publish: jest.fn() } as unknown as EventBusExtended,
      contextSrv: { user: { isSignedIn: true, authenticatedBy }, setRedirectToUrl: jest.fn() } as unknown as ContextSrv,
    });
    return { srv, paths, logout };
  }

  it.each(['future', 'missing', 'invalid', 'past', 'jwt-label', 'extendedjwt-label'])(
    'recovers without logout when the expiry state is %s',
    async (state) => {
      if (state !== 'missing') {
        const expiry = state === 'invalid' ? 'invalid' : Math.floor(Date.now() / 1000) + (state === 'past' ? -60 : 575);
        document.cookie = `grafana_session_expiry=${expiry}; Path=/`;
      }
      const authenticatedBy = state.endsWith('-label') ? state.replace('-label', '') : 'oauth_azuread';
      const { srv, paths, logout } = setup({ authenticatedBy });
      await expect(srv.request({ url: '/api/ds/query', method: 'POST', retry: 0 })).resolves.toEqual({ results: {} });
      expect(paths).toEqual(['/api/ds/query', '/api/user/auth-tokens/rotate', '/api/ds/query']);
      expect(logout).not.toHaveBeenCalled();
    }
  );

  it('keeps the normal login check for a generic JWT authentication failure', async () => {
    const { srv, paths, logout } = setup({ authenticatedBy: 'jwt', messageId: 'auth.unauthorized' });
    await expect(srv.request({ url: '/api/ds/query', method: 'POST', retry: 0 })).rejects.toMatchObject({
      status: 401,
    });
    expect(paths).toEqual(['/api/ds/query', '/api/login/ping']);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('does not rotate repeatedly if the retried query still fails', async () => {
    document.cookie = `grafana_session_expiry=${Math.floor(Date.now() / 1000) + 575}; Path=/`;
    const { srv, paths, logout } = setup({ retryStatus: 401 });
    await expect(srv.request({ url: '/api/ds/query', method: 'POST', retry: 0 })).rejects.toMatchObject({
      status: 401,
    });
    expect(paths).toEqual(['/api/ds/query', '/api/user/auth-tokens/rotate', '/api/ds/query']);
    expect(logout).not.toHaveBeenCalled();
  });

  it.each([401, 500])('preserves rotation failure handling for status %s', async (rotationStatus) => {
    const { srv, paths, logout } = setup({ rotationStatus });
    await expect(srv.request({ url: '/api/ds/query', method: 'POST', retry: 0 })).rejects.toMatchObject({
      status: rotationStatus,
    });
    expect(paths).toEqual(['/api/ds/query', '/api/user/auth-tokens/rotate']);
    expect(logout).toHaveBeenCalledTimes(rotationStatus === 401 ? 1 : 0);
  });
});
