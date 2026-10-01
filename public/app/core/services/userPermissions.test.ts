import { getBackendSrv, logError } from '@grafana/runtime';

import { loadUserPermissions } from './userPermissions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  logError: jest.fn(),
}));

const mockGet = jest.fn();

function mockResponse(result: Promise<unknown>) {
  mockGet.mockReturnValue(result);
}

describe('loadUserPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getBackendSrv).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof getBackendSrv>);
  });

  it('reduces the flat action/scope list into an action-keyed map, deduping repeated actions', async () => {
    mockResponse(
      Promise.resolve({
        permissions: [
          { action: 'dashboards:read', scope: 'dashboards:uid:a' },
          { action: 'dashboards:read', scope: 'dashboards:uid:b' },
          { action: 'playlists:write', scope: '' },
        ],
      })
    );

    expect(await loadUserPermissions()).toEqual({
      'dashboards:read': true,
      'playlists:write': true,
    });
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/apis\/iam\.grafana\.app\/v0alpha1\/namespaces\/.*\/users\/~\/permissions$/),
      { skipCache: true },
      undefined,
      { showErrorAlert: false }
    );
  });

  // A successful response with no permissions is the real answer, so it stays an
  // empty map — only a failed request resolves to null.
  it('returns an empty map for an empty response', async () => {
    mockResponse(Promise.resolve({ permissions: [] }));
    expect(await loadUserPermissions()).toEqual({});
  });

  // backendSrv rejects with a FetchError carrying the message under data rather
  // than an Error instance, so it has to be extracted from that shape.
  it('returns null and logs the error message when the request fails', async () => {
    mockResponse(Promise.reject({ status: 500, data: { message: 'authz exploded' } }));

    expect(await loadUserPermissions()).toBeNull();
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ message: 'authz exploded' }));
  });

  it('falls back to a generic message when the error carries none', async () => {
    mockResponse(Promise.reject({ status: 500 }));

    expect(await loadUserPermissions()).toBeNull();
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to load user permissions' }));
  });
});
