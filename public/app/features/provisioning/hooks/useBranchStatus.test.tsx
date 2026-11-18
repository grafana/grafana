import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { useBranchStatus } from './useBranchStatus';

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

const resolving = { isNewBranch: false, isResolving: true };
const existing = { isNewBranch: false, isResolving: false };
const created = { isNewBranch: true, isResolving: false };

function render(repository: RepositoryView | undefined, ref: string) {
  return renderHook(() => useBranchStatus(repository, ref), { wrapper: getWrapper({}) });
}

describe('useBranchStatus', () => {
  it('resolves the configured branch immediately as a direct write', () => {
    expect(render(repo, 'main').result.current).toEqual(existing);
  });

  it('resolves an existing remote branch once the refs load', async () => {
    const { result } = render(repo, 'develop');
    expect(result.current).toEqual(resolving);
    await waitFor(() => expect(result.current).toEqual(existing));
  });

  it('resolves a branch absent from the refs as new', async () => {
    const { result } = render(repo, 'feature/x');
    expect(result.current).toEqual(resolving);
    await waitFor(() => expect(result.current).toEqual(created));
  });

  it('goes back to resolving while a newly selected repository loads its refs', async () => {
    // Neither repository knows `feature/x`; the second one answers slowly. Only the first repository's
    // confirmed answer could leak through a stale `data` read while the second one loads.
    server.use(
      http.get(`${BASE}/repositories/:name/refs`, async ({ params }) => {
        if (params.name === 'other') {
          await delay(50);
        }
        return HttpResponse.json({ items: [{ name: 'main' }] });
      })
    );

    const { result, rerender } = renderHook(({ repository }) => useBranchStatus(repository, 'feature/x'), {
      wrapper: getWrapper({}),
      initialProps: { repository: repo },
    });
    await waitFor(() => expect(result.current).toEqual(created));

    rerender({ repository: { ...repo, name: 'other' } });
    expect(result.current).toEqual(resolving);
    await waitFor(() => expect(result.current).toEqual(created));
  });

  it('stops resolving and treats the branch as existing when the refs request fails', async () => {
    server.use(http.get(`${BASE}/repositories/:name/refs`, () => HttpResponse.json({}, { status: 500 })));

    const { result } = render(repo, 'feature/x');
    expect(result.current).toEqual(resolving);
    await waitFor(() => expect(result.current).toEqual(existing));
  });

  it('never resolves anything without a git repository', () => {
    expect(render({ ...repo, type: 'local', branch: undefined }, '').result.current).toEqual(existing);
    expect(render(undefined, 'anything').result.current).toEqual(existing);
  });
});
