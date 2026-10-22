import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { useIsNewBranch } from './useIsNewBranch';

setupProvisioningMswServer();

// MSW default refs for a git repo: { items: [{ name: 'main' }, { name: 'develop' }] }.
const repo: RepositoryView = {
  name: 'repo',
  type: 'github',
  branch: 'main',
  workflows: ['write', 'branch'],
  target: 'folder',
  title: 'r',
};

function render(repository: RepositoryView | undefined, ref: string) {
  return renderHook(() => useIsNewBranch(repository, ref), { wrapper: getWrapper({}) });
}

describe('useIsNewBranch', () => {
  it('returns false immediately for the configured branch (a direct write)', () => {
    const { result } = render(repo, 'main');
    expect(result.current).toBe(false);
  });

  it('stays false for an existing remote branch', async () => {
    const { result } = render(repo, 'develop');
    expect(result.current).toBe(false);
    // Still false once the refs confirm the branch exists.
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('becomes true only once the refs confirm the branch is absent', async () => {
    const { result } = render(repo, 'feature/x');
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('falls back to false while a newly selected repository loads its refs', async () => {
    // Refs differ per repository: the first repo knows `feature/x`, the second does not and is slow.
    server.use(
      http.get(`${BASE}/repositories/:name/refs`, async ({ params }) => {
        if (params.name === 'other') {
          await delay(50);
          return HttpResponse.json({ items: [{ name: 'main' }] });
        }
        return HttpResponse.json({ items: [{ name: 'main' }, { name: 'feature/x' }] });
      })
    );

    const { result, rerender } = renderHook(({ repository }) => useIsNewBranch(repository, 'feature/x'), {
      wrapper: getWrapper({}),
      initialProps: { repository: repo },
    });
    await waitFor(() => expect(result.current).toBe(false));

    // The first repository's answer must not stand in for the second while it loads.
    rerender({ repository: { ...repo, name: 'other' } });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when the refs request fails', async () => {
    server.use(http.get(`${BASE}/repositories/:name/refs`, () => HttpResponse.json({}, { status: 500 })));

    // Observe the query alongside the hook: its own return value is false both while loading and
    // after a failure, so only the query's error state proves the failure was reached.
    const { result } = renderHook(
      () => ({ isNew: useIsNewBranch(repo, 'feature/x'), refs: useGetRepositoryRefsQuery({ name: repo.name }) }),
      { wrapper: getWrapper({}) }
    );
    await waitFor(() => expect(result.current.refs.isError).toBe(true));
    expect(result.current.isNew).toBe(false);
  });

  it('returns false without hitting the refs query when there is no git repository', () => {
    expect(render({ ...repo, type: 'local', branch: undefined }, '').result.current).toBe(false);
    expect(render(undefined, 'anything').result.current).toBe(false);
  });
});
