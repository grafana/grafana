import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { setupProvisioningMswServer } from '../mocks/server';

import { useGetRepositoryFolders } from './useGetRepositoryFolders';

setupProvisioningMswServer();

describe('useGetRepositoryFolders', () => {
  it('should extract unique folder paths from file items', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({
          items: [{ path: 'dashboards/prod/dashboard.json' }, { path: 'dashboards/staging/dashboard.json' }],
        })
      )
    );

    const { result } = renderHook(() => useGetRepositoryFolders({ repositoryName: 'test-repo' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() =>
      expect(result.current.options).toEqual([
        { label: 'dashboards', value: 'dashboards' },
        { label: 'dashboards/prod', value: 'dashboards/prod' },
        { label: 'dashboards/staging', value: 'dashboards/staging' },
      ])
    );
  });

  it('should exclude dot-prefixed paths', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () =>
        HttpResponse.json({
          items: [
            { path: '.grafana/folder-metadata-fixed-1772438142' },
            { path: '.github/workflows/ci.yml' },
            { path: 'dashboards/dashboard.json' },
          ],
        })
      )
    );

    const { result } = renderHook(() => useGetRepositoryFolders({ repositoryName: 'test-repo' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.options).toEqual([{ label: 'dashboards', value: 'dashboards' }]));
  });

  it('should return empty options for root-level files', async () => {
    server.use(
      http.get(`${BASE}/repositories/:name/files/`, () => HttpResponse.json({ items: [{ path: 'dashboard.json' }] }))
    );

    const { result } = renderHook(() => useGetRepositoryFolders({ repositoryName: 'test-repo' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.options).toEqual([]));
  });

  it('should return hint when no repository name is provided', () => {
    const { result } = renderHook(() => useGetRepositoryFolders({}), {
      wrapper: getWrapper({}),
    });

    expect(result.current.hint).toBe('Folder suggestions will be available after the repository is connected.');
    expect(result.current.options).toEqual([]);
  });

  it('should surface repo-status error when repository query fails', async () => {
    server.use(http.get(`${BASE}/repositories`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useGetRepositoryFolders({ repositoryName: 'test-repo' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() =>
      expect(result.current.error).toBe(
        'There was an issue connecting to the repository. You can still manually enter the folder path.'
      )
    );
  });
});
