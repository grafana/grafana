import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { createRepository } from 'app/features/provisioning/mocks/factories';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { type Repository, useListRepositoryQuery, useReplaceRepositoryMutation } from './index';

setupProvisioningMswServer();

const NAME = 'test-repo-abc123'; // createRepository() default name
const byName = (name: string) => ({ fieldSelector: `metadata.name=${name}`, watch: true });

// observedGeneration defaults to 1, so generation 2 means "spec changed, not reconciled"
function repo(name: string, generation: number, resourceVersion: string, observedGeneration = 1): Repository {
  return createRepository({ metadata: { name, generation, resourceVersion }, status: { observedGeneration } });
}

/**
 * Fake list server. Responses use the items as they were when the request arrived (a server
 * reads before it responds). While `hold()` is active, GETs wait until released.
 */
function serveRepositories(initial: Repository[]) {
  let items = initial;
  let holding = false;
  let gets = 0;
  const waiting: Array<() => void> = [];
  server.use(
    http.get(`${BASE}/repositories`, async ({ request }) => {
      gets++;
      const selector = new URL(request.url).searchParams.get('fieldSelector');
      const snapshot = items.filter((item) => !selector || selector === `metadata.name=${item.metadata?.name}`);
      if (holding) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return HttpResponse.json({ items: snapshot, metadata: { resourceVersion: String(10 + gets) } });
    })
  );
  return {
    set: (next: Repository[]) => {
      items = next;
    },
    hold: () => {
      holding = true;
    },
    releaseOne: () => waiting.shift()?.(),
    releaseAll: () => {
      holding = false;
      waiting.splice(0).forEach((resolve) => resolve());
    },
    gets: () => gets,
  };
}

function servePut(onPut: () => Repository) {
  server.use(http.put(`${BASE}/repositories/:name`, () => HttpResponse.json(onPut())));
}

function renderMine() {
  return renderHook(
    () => ({
      mine: useListRepositoryQuery(byName(NAME)),
      other: useListRepositoryQuery(byName('other-repo')),
      replace: useReplaceRepositoryMutation()[0],
    }),
    { wrapper: getWrapper({}) }
  );
}

// While a refetch is pending, RTK pins an existing hook's `data` to its last result; `currentData`
// is the store entry itself. A hook mounted after the save (the wizard's synchronize step) reads
// the store entry, so that is what the cache rules are asserted against.
describe('provisioningAPIv0alpha1 listRepository cache', () => {
  it('shows the replaceRepository response in cached lists while the invalidation refetch is in flight', async () => {
    const lists = serveRepositories([repo(NAME, 1, '5')]);
    const updated = repo(NAME, 2, '6');
    servePut(() => {
      lists.set([updated]);
      return updated;
    });
    const { result } = renderMine();
    await waitFor(() => expect(result.current.mine.data?.items).toHaveLength(1));
    await waitFor(() => expect(result.current.other.data?.items).toEqual([]));

    lists.hold();
    await act(async () => {
      await result.current.replace({ name: NAME, repository: updated }).unwrap();
    });

    expect(result.current.mine.currentData?.items[0].metadata).toMatchObject({ generation: 2, resourceVersion: '6' });
    // never inserted into a list that did not contain it
    expect(result.current.other.currentData?.items).toEqual([]);

    lists.releaseAll();
    await waitFor(() => expect(result.current.mine.isFetching).toBe(false));
  });

  it('keeps the replaceRepository response when a list GET issued before the PUT fulfils afterwards with the old object', async () => {
    const lists = serveRepositories([repo(NAME, 1, '5')]);
    const updated = repo(NAME, 2, '6');
    servePut(() => {
      lists.set([updated]);
      return updated;
    });
    const { result } = renderMine();
    await waitFor(() => expect(result.current.mine.data?.items).toHaveLength(1));
    await waitFor(() => expect(result.current.other.data?.items).toEqual([]));

    // a GET that read the pre-PUT object and is still in flight when the PUT completes
    lists.hold();
    act(() => {
      result.current.mine.refetch();
    });
    await waitFor(() => expect(lists.gets()).toBe(3)); // mine + other initial, then the held refetch

    await act(async () => {
      await result.current.replace({ name: NAME, repository: updated }).unwrap();
    });
    expect(result.current.mine.currentData?.items[0].metadata?.resourceVersion).toBe('6');

    // the stale GET fulfils; RTK then dispatches the deferred invalidation refetches (held too)
    lists.releaseOne();
    await waitFor(() => expect(lists.gets()).toBeGreaterThanOrEqual(4));
    expect(result.current.mine.currentData?.items[0].metadata).toMatchObject({ generation: 2, resourceVersion: '6' });

    lists.releaseAll();
    await waitFor(() => expect(result.current.mine.isFetching).toBe(false));
    expect(result.current.mine.data?.items[0].metadata).toMatchObject({ generation: 2, resourceVersion: '6' });
  });

  it('does not overwrite a cached repository that is already newer than the replaceRepository response', async () => {
    // reconciled watch state already in the cache; the PUT response is an older representation
    const lists = serveRepositories([repo(NAME, 2, '9', 2)]);
    const older = repo(NAME, 2, '6');
    servePut(() => older);
    const { result } = renderMine();
    await waitFor(() => expect(result.current.mine.data?.items).toHaveLength(1));
    await waitFor(() => expect(result.current.other.data?.items).toEqual([]));
    const before = result.current.mine.currentData;

    lists.hold();
    await act(async () => {
      await result.current.replace({ name: NAME, repository: older }).unwrap();
    });

    expect(result.current.mine.currentData).toBe(before);

    lists.releaseAll();
    await waitFor(() => expect(result.current.mine.isFetching).toBe(false));
  });

  it('follows the fresh list for membership and newer versions when refetching', async () => {
    const lists = serveRepositories([repo('a', 1, '5'), repo('b', 1, '5')]);
    const { result } = renderHook(() => useListRepositoryQuery({ watch: true }), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));

    lists.set([repo('a', 2, '7')]);
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(result.current.data?.items[0].metadata).toMatchObject({ name: 'a', generation: 2, resourceVersion: '7' });
  });
});
