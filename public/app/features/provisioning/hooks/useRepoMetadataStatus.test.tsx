import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { useRepoMetadataStatus } from './useRepoMetadataStatus';

setupProvisioningMswServer();

function makeResource(overrides: Partial<ResourceListItem> & { path: string }): ResourceListItem {
  return {
    name: 'resource-uid',
    group: 'folder.grafana.app',
    resource: 'folders',
    hash: '',
    folder: '',
    ...overrides,
  };
}

describe('useRepoMetadataStatus', () => {
  it('returns error when files query errors', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('returns error when resources query errors', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/resources`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('returns ok when all provisioned folders have _folder.json', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({
          items: [
            { path: 'subfolder/_folder.json', hash: 'def' },
            { path: 'subfolder/dashboard.json', hash: 'ghi' },
          ],
        })
      ),
      http.get(`${BASE}/repositories/:name/resources`, () =>
        HttpResponse.json({
          items: [makeResource({ path: 'subfolder', resource: 'folders' })],
        })
      )
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('ok'));
  });

  it('returns ok when repo has no files and no resources', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () => HttpResponse.json({ items: [] })),
      http.get(`${BASE}/repositories/:name/resources`, () => HttpResponse.json({ items: [] }))
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('ok'));
  });

  it('returns ok when repo has only root-level files with no folder resources', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({ items: [{ path: 'dashboard.json', hash: 'abc' }] })
      ),
      http.get(`${BASE}/repositories/:name/resources`, () =>
        HttpResponse.json({
          items: [makeResource({ path: 'dashboard.json', resource: 'dashboards', name: 'dash-uid' })],
        })
      )
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('ok'));
  });

  it('returns ok when files exist in subdirectories but no provisioned folder resources exist (no false positive)', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({ items: [{ path: 'subfolder/dashboard.json', hash: 'def' }] })
      ),
      http.get(`${BASE}/repositories/:name/resources`, () =>
        HttpResponse.json({
          items: [makeResource({ path: 'subfolder/dashboard.json', resource: 'dashboards', name: 'dash-uid' })],
        })
      )
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('ok'));
  });

  it('returns missing when a provisioned folder is missing _folder.json', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({ items: [{ path: 'subfolder/dashboard.json', hash: 'def' }] })
      ),
      http.get(`${BASE}/repositories/:name/resources`, () =>
        HttpResponse.json({
          items: [
            makeResource({ path: 'subfolder', resource: 'folders', name: 'folder-uid' }),
            makeResource({ path: 'subfolder/dashboard.json', resource: 'dashboards', name: 'dash-uid' }),
          ],
        })
      )
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });

  it('returns missing when a deeply nested provisioned folder is missing _folder.json', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({
          items: [
            { path: 'a/_folder.json', hash: 'def' },
            { path: 'a/b/dashboard.json', hash: 'ghi' },
          ],
        })
      ),
      http.get(`${BASE}/repositories/:name/resources`, () =>
        HttpResponse.json({
          items: [
            makeResource({ path: 'a', resource: 'folders', name: 'folder-a' }),
            makeResource({ path: 'a/b', resource: 'folders', name: 'folder-b' }),
          ],
        })
      )
    );

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });
});
