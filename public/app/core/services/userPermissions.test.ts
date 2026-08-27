import { logError } from '@grafana/runtime';
import { dispatch } from 'app/store/store';

import { loadUserPermissions } from './userPermissions';

jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logError: jest.fn(),
}));

const mockDispatch = jest.mocked(dispatch);

function mockResponse(result: Promise<unknown>) {
  mockDispatch.mockReturnValue({ unwrap: () => result } as unknown as ReturnType<typeof dispatch>);
}

describe('loadUserPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  // A successful response with no permissions is the real answer, so it stays an
  // empty map — only a failed request resolves to null.
  it('returns an empty map for an empty response', async () => {
    mockResponse(Promise.resolve({ permissions: [] }));
    expect(await loadUserPermissions()).toEqual({});
  });

  // unwrap() rejects with a serialised RTK Query error, not an Error instance,
  // so the message has to be extracted from that shape rather than passed through.
  it('returns null and logs the error message when the request fails', async () => {
    mockResponse(Promise.reject({ status: 500, data: { message: 'authz exploded' } }));

    expect(await loadUserPermissions()).toBeNull();
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ message: 'authz exploded' }));
  });

  it('falls back to a generic message when the error carries none', async () => {
    mockResponse(Promise.reject({ status: 'FETCH_ERROR' }));

    expect(await loadUserPermissions()).toBeNull();
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to load user permissions' }));
  });
});
