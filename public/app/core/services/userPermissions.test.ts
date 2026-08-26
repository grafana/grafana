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

  it('returns null and logs the error when the request fails', async () => {
    mockResponse(Promise.reject(new Error('boom')));

    expect(await loadUserPermissions()).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
