import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';

import { createJob } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';

import { useSyncJob } from './useSyncJob';

setupProvisioningMswServer();

describe('useSyncJob', () => {
  it('starts a migrate job and exposes the created job', async () => {
    let body = '';
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(createJob());
      })
    );

    const { result } = renderHook(() => useSyncJob({ repoName: 'repo-1' }), { wrapper: getWrapper({}) });

    await act(() => result.current.startJob(true));

    await waitFor(() => expect(result.current.job).toBeDefined());
    expect(body).toContain('"action":"migrate"');
  });

  it('threads requiresMigration=false through to a pull job', async () => {
    let body = '';
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(createJob());
      })
    );

    const { result } = renderHook(() => useSyncJob({ repoName: 'repo-1' }), { wrapper: getWrapper({}) });

    await act(() => result.current.startJob(false));

    await waitFor(() => expect(result.current.job).toBeDefined());
    expect(body).toContain('"action":"pull"');
  });

  it('does not set a job when no repository is selected', async () => {
    const { result } = renderHook(() => useSyncJob({ repoName: '' }), { wrapper: getWrapper({}) });

    await act(() => result.current.startJob(true));

    expect(result.current.job).toBeUndefined();
  });

  it('clears the job when setJob(undefined) is called', async () => {
    server.use(http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(createJob())));

    const { result } = renderHook(() => useSyncJob({ repoName: 'repo-1' }), { wrapper: getWrapper({}) });

    await act(() => result.current.startJob(true));
    await waitFor(() => expect(result.current.job).toBeDefined());

    act(() => result.current.setJob(undefined));

    expect(result.current.job).toBeUndefined();
  });
});
