import { configureStore } from '@reduxjs/toolkit';
import { of } from 'rxjs';

import { type APIGroupInfo, config, getBackendSrv, invalidateAPIDiscovery } from '@grafana/runtime';
// Test-only: this file is never bundled, so the published package keeps no /internal import.
// eslint-disable-next-line no-restricted-imports
import { setAPIDiscoveryForTesting } from '@grafana/runtime/internal';

import { generatedAPI } from './index';

let mockRuntimeHasAPIDiscovery = true;

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getBackendSrv: jest.fn(),
    // Runtimes before API discovery don't export it, and the client still has to work there.
    get resolveAPIBaseURL() {
      return mockRuntimeHasAPIDiscovery ? actual.resolveAPIBaseURL : undefined;
    },
  };
});

const folderGroup = (versions: string[], preferredVersion: string): APIGroupInfo => ({
  group: 'folder.grafana.app',
  versions,
  preferredVersion,
});

async function requestedFolderURL(): Promise<string> {
  const fetch = jest.fn().mockReturnValue(of({ data: {} }));
  jest.mocked(getBackendSrv).mockReturnValue({ ...getBackendSrv(), fetch });
  const store = configureStore({
    reducer: { [generatedAPI.reducerPath]: generatedAPI.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).concat(generatedAPI.middleware),
  });

  try {
    await store.dispatch(generatedAPI.endpoints.getFolder.initiate({ name: 'abc' })).unwrap();
    expect(fetch).toHaveBeenCalledTimes(1);
    return fetch.mock.calls[0][0].url;
  } finally {
    store.dispatch(generatedAPI.util.resetApiState());
  }
}

describe('folder client base URL', () => {
  afterEach(() => {
    mockRuntimeHasAPIDiscovery = true;
    invalidateAPIDiscovery();
  });

  it.each([
    { served: folderGroup(['v1', 'v1beta1'], 'v1'), expected: 'v1' },
    { served: folderGroup(['v2', 'v1', 'v1beta1'], 'v2'), expected: 'v1' },
    { served: folderGroup(['v1beta1', 'v1'], 'v1beta1'), expected: 'v1beta1' },
    { served: folderGroup(['v1beta1'], 'v1beta1'), expected: 'v1beta1' },
  ])(
    'calls $expected when the server serves $served.versions and prefers $served.preferredVersion',
    async ({ served, expected }) => {
      setAPIDiscoveryForTesting([served]);

      expect(await requestedFolderURL()).toBe(
        `/apis/folder.grafana.app/${expected}/namespaces/${config.namespace}/folders/abc`
      );
    }
  );

  it('falls back to v1beta1 when discovery cannot answer', async () => {
    // Without seeded answers or a user session, discovery resolves unknown without a request.
    invalidateAPIDiscovery();

    expect(await requestedFolderURL()).toBe(
      `/apis/folder.grafana.app/v1beta1/namespaces/${config.namespace}/folders/abc`
    );
  });

  it('falls back to v1beta1 when the runtime has no API discovery', async () => {
    setAPIDiscoveryForTesting([folderGroup(['v1', 'v1beta1'], 'v1')]);
    mockRuntimeHasAPIDiscovery = false;

    expect(await requestedFolderURL()).toBe(
      `/apis/folder.grafana.app/v1beta1/namespaces/${config.namespace}/folders/abc`
    );
  });
});
