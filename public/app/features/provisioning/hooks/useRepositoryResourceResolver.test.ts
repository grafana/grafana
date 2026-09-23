import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { provisioningAPIv0alpha1, type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';
import { getState } from 'app/store/store';
import { dispatch } from 'app/types/store';

import { setupProvisioningMswServer } from '../mocks/server';

import { useRepositoryResourceResolver } from './useRepositoryResourceResolver';

setupProvisioningMswServer();

describe('useRepositoryResourceResolver', () => {
  it.each([
    {
      name: 'resource lookup',
      path: 'cpu.json',
      resource: { path: 'cpu.json', name: 'cpu', group: 'dashboard.grafana.app', resource: 'dashboards', hash: '' },
    },
    {
      name: 'root listing',
      path: '/',
      resource: { path: '', name: 'root', group: 'folder.grafana.app', resource: 'folders', hash: '' },
    },
  ])('preserves a successful $name when sync invalidation waits for pending requests', async ({ path, resource }) => {
    const fileStarted = jest.fn();
    const lookupStarted = jest.fn();
    let releaseFile!: () => void;
    let releaseLookup!: () => void;
    const fileReady = new Promise<void>((resolve) => {
      releaseFile = resolve;
    });
    const lookupReady = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    server.use(
      http.get(`${BASE}/repositories/:name/files/*`, async () => {
        fileStarted();
        await fileReady;
        return HttpResponse.json({ resource: { file: '# README' } });
      }),
      http.post(`${BASE}/repositories/:name/resources/resolve`, async () => {
        lookupStarted();
        await lookupReady;
        return HttpResponse.json({ results: [{ path: 'cpu.json', resource }] });
      }),
      http.get(`${BASE}/repositories/:name/resources`, async () => {
        lookupStarted();
        await lookupReady;
        return HttpResponse.json({ items: [resource] });
      })
    );

    const { result, rerender } = renderHook(({ sync }) => useRepositoryResourceResolver('test-repo', sync), {
      wrapper: getWrapper({}),
      initialProps: { sync: 1 },
    });
    const fileRequest = dispatch(
      provisioningAPIv0alpha1.endpoints.getRepositoryFilesWithPath.initiate({ name: 'test-repo', path: 'README.md' })
    );
    await waitFor(() => expect(fileStarted).toHaveBeenCalledTimes(1));
    rerender({ sync: 2 });

    let lookup!: Promise<ResourceListItem[]>;
    act(() => {
      lookup = result.current.resolve(path);
    });
    await waitFor(() => expect(lookupStarted).toHaveBeenCalledTimes(1));
    await act(async () => {
      releaseFile();
      await fileRequest.unwrap();
    });
    let resolved: ResourceListItem[] = [];
    await act(async () => {
      releaseLookup();
      resolved = await lookup;
    });
    fileRequest.unsubscribe();

    expect(resolved).toEqual([resource]);
  });

  it.each([200, 403])('releases the lookup subscription after HTTP %s', async (status) => {
    const resource: ResourceListItem = {
      path: 'cpu.json',
      name: 'cpu',
      group: 'dashboard.grafana.app',
      resource: 'dashboards',
      hash: '',
    };
    server.use(
      http.post(`${BASE}/repositories/:name/resources/resolve`, () =>
        HttpResponse.json(
          status === 200 ? { results: [{ path: 'cpu.json', resource }] } : { message: 'Permission denied' },
          { status }
        )
      )
    );
    const { result } = renderHook(() => useRepositoryResourceResolver('test-repo', undefined), {
      wrapper: getWrapper({}),
    });
    const selectLookup = provisioningAPIv0alpha1.endpoints.resolveRepositoryResources.select({
      name: 'test-repo',
      resourceResolveRequest: { paths: ['cpu.json'] },
    });
    await act(async () => {
      expect(await result.current.resolve('cpu.json')).toEqual(status === 200 ? [resource] : []);
    });
    expect(selectLookup(getState()).status).toBe(status === 200 ? 'fulfilled' : 'rejected');

    act(() => {
      dispatch(provisioningAPIv0alpha1.util.invalidateTags([{ type: 'Repository', id: 'resources:test-repo' }]));
    });

    await waitFor(() => expect(selectLookup(getState()).status).toBe('uninitialized'));
  });
});
