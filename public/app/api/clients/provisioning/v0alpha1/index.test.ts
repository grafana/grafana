import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { createRepository } from 'app/features/provisioning/mocks/factories';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import {
  type Repository,
  useCreateRepositoryTestMutation,
  useListRepositoryQuery,
  useReplaceRepositoryMutation,
} from './index';

setupProvisioningMswServer();

const NAME = 'test-repo-abc123'; // createRepository() default name
const byName = (name: string) => ({ fieldSelector: `metadata.name=${name}`, watch: true });

// observedGeneration defaults to 1, so generation 2 means "spec changed, not reconciled"
function repo(name: string, generation: number, resourceVersion: string, observedGeneration = 1): Repository {
  return createRepository({ metadata: { name, generation, resourceVersion }, status: { observedGeneration } });
}

/**
 * Fake list server. Responses use the items as they were when the request arrived (a server
 * reads before it responds). While held, responses wait until released.
 */
function serveRepositories(initial: Repository[]) {
  let items = initial;
  let gate = Promise.resolve();
  let release = () => {};
  server.use(
    http.get(`${BASE}/repositories`, async ({ request }) => {
      const selector = new URL(request.url).searchParams.get('fieldSelector');
      const snapshot = items.filter((item) => !selector || selector === `metadata.name=${item.metadata?.name}`);
      await gate;
      return HttpResponse.json({ items: snapshot, metadata: { resourceVersion: '10' } });
    })
  );
  return {
    set: (next: Repository[]) => {
      items = next;
    },
    hold: () => {
      gate = new Promise<void>((resolve) => (release = resolve));
    },
    release: () => release(),
  };
}

function servePut(onPut: () => Repository) {
  server.use(http.put(`${BASE}/repositories/:name`, () => HttpResponse.json(onPut())));
}

async function renderLoadedLists() {
  const { result } = renderHook(
    () => ({
      mine: useListRepositoryQuery(byName(NAME)),
      other: useListRepositoryQuery(byName('other-repo')),
      replace: useReplaceRepositoryMutation()[0],
      test: useCreateRepositoryTestMutation()[0],
    }),
    { wrapper: getWrapper({}) }
  );
  await waitFor(() => expect(result.current.mine.data?.items).toHaveLength(1));
  await waitFor(() => expect(result.current.other.data?.items).toEqual([]));
  return result;
}

// `currentData` is the store entry itself, which is what a hook mounted after a save reads;
// `data` may lag behind it while a refetch is pending.
describe('provisioningAPIv0alpha1 listRepository cache', () => {
  it('shows the replaceRepository response in cached lists before the invalidation refetch lands', async () => {
    const lists = serveRepositories([repo(NAME, 1, '5')]);
    const updated = repo(NAME, 2, '6');
    servePut(() => {
      lists.set([updated]);
      return updated;
    });
    const result = await renderLoadedLists();

    lists.hold();
    await act(async () => {
      await result.current.replace({ name: NAME, repository: updated }).unwrap();
    });

    expect(result.current.mine.currentData?.items[0].metadata).toMatchObject({ generation: 2, resourceVersion: '6' });
    // never inserted into a list that did not contain it
    expect(result.current.other.currentData?.items).toEqual([]);

    lists.release();
    await waitFor(() => expect(result.current.mine.isFetching).toBe(false));
  });

  it('does not overwrite a cached repository that is already newer than the replaceRepository response', async () => {
    // reconciled watch state already in the cache; the PUT response is an older representation
    const lists = serveRepositories([repo(NAME, 2, '9', 2)]);
    const older = repo(NAME, 2, '6');
    servePut(() => older);
    const result = await renderLoadedLists();
    const before = result.current.mine.currentData;

    lists.hold();
    await act(async () => {
      await result.current.replace({ name: NAME, repository: older }).unwrap();
    });

    expect(result.current.mine.currentData).toBe(before);

    lists.release();
    await waitFor(() => expect(result.current.mine.isFetching).toBe(false));
  });

  it('does not refetch cached repository lists after a connection test', async () => {
    const stored = repo(NAME, 1, '5');
    serveRepositories([stored]);
    const result = await renderLoadedLists();

    await act(async () => {
      await result.current.test({ name: NAME, body: { spec: stored.spec } }).unwrap();
    });

    // an invalidation would have marked the list pending synchronously
    expect(result.current.mine.isFetching).toBe(false);
    expect(result.current.mine.currentData?.items[0].metadata?.resourceVersion).toBe('5');
  });
});
