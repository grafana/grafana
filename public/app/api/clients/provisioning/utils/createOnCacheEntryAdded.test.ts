import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { createJob } from 'app/features/provisioning/mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { type Job, useListJobQuery } from '../v0alpha1';

setupProvisioningMswServer();

function job(name: string, resourceVersion?: string, state = 'working'): Job {
  return createJob({ metadata: { name, resourceVersion }, status: { state } });
}

async function setup(...items: Job[]) {
  server.use(http.get(`${BASE}/jobs`, () => HttpResponse.json({ items, metadata: { resourceVersion: '10' } })));

  const getStream = jest.spyOn(getMockLiveSrv(), 'getStream');
  const callsBefore = getStream.mock.calls.length;

  const { result } = renderHook(() => useListJobQuery({ watch: true }), { wrapper: getWrapper({}) });

  await waitFor(() => expect(result.current.data).toBeDefined());
  // the handler only subscribes to the watch stream after the initial list resolves;
  // events emitted before that are lost, so wait for the subscription to attach
  await waitFor(() => expect(getStream.mock.calls.length).toBeGreaterThan(callsBefore));

  return result;
}

function emit(type: 'ADDED' | 'MODIFIED' | 'DELETED', object: Job) {
  act(() => {
    getMockLiveSrv().emitWatchEvent('jobs', { type, object });
  });
}

describe('createOnCacheEntryAdded', () => {
  it('appends an ADDED event for a job not in the cache', async () => {
    const result = await setup(job('a', '5'));

    emit('ADDED', job('b', '11'));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(result.current.data?.items[1].metadata?.name).toBe('b');
  });

  it('applies a MODIFIED event with a newer resourceVersion', async () => {
    const result = await setup(job('a', '5'));

    emit('MODIFIED', job('a', '11', 'success'));

    await waitFor(() => expect(result.current.data?.items[0].status?.state).toBe('success'));
    expect(result.current.data?.items[0].metadata?.resourceVersion).toBe('11');
  });

  it('compares resourceVersions numerically, not lexicographically', async () => {
    const result = await setup(job('a', '9'));

    // '10' < '9' as strings, but 10 > 9 numerically — the event must apply
    emit('MODIFIED', job('a', '10', 'success'));

    await waitFor(() => expect(result.current.data?.items[0].metadata?.resourceVersion).toBe('10'));
  });

  it('skips a stale MODIFIED event with an older resourceVersion', async () => {
    const result = await setup(job('a', '5'));

    emit('MODIFIED', job('a', '8', 'success'));
    await waitFor(() => expect(result.current.data?.items[0].metadata?.resourceVersion).toBe('8'));

    const before = result.current.data;
    emit('MODIFIED', job('a', '6', 'working'));

    // same reference: no store update, no re-render for subscribers
    expect(result.current.data).toBe(before);
    expect(result.current.data?.items[0].status?.state).toBe('success');
  });

  it('skips a duplicate MODIFIED event with an equal resourceVersion', async () => {
    const result = await setup(job('a', '5'));

    emit('MODIFIED', job('a', '8', 'success'));
    await waitFor(() => expect(result.current.data?.items[0].metadata?.resourceVersion).toBe('8'));

    const before = result.current.data;
    emit('MODIFIED', job('a', '8', 'success'));

    expect(result.current.data).toBe(before);
  });

  it('skips a duplicate ADDED event for a job already in the cache', async () => {
    const result = await setup(job('a', '8'));

    emit('ADDED', job('b', '9'));
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));

    const before = result.current.data;
    emit('ADDED', job('a', '8'));

    expect(result.current.data).toBe(before);
  });

  it('applies a MODIFIED event without a resourceVersion (fail open)', async () => {
    const result = await setup(job('a', '8'));

    emit('MODIFIED', job('a', undefined, 'success'));

    await waitFor(() => expect(result.current.data?.items[0].status?.state).toBe('success'));
  });

  it('applies a MODIFIED event when the cached job has no resourceVersion (fail open)', async () => {
    const result = await setup(job('a'));

    emit('MODIFIED', job('a', '2', 'success'));

    await waitFor(() => expect(result.current.data?.items[0].status?.state).toBe('success'));
  });

  it('removes a job on DELETED and ignores a duplicate DELETED', async () => {
    const result = await setup(job('a', '5'), job('b', '7'));

    emit('DELETED', job('a', '11'));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(result.current.data?.items[0].metadata?.name).toBe('b');

    const before = result.current.data;
    emit('DELETED', job('a', '11'));

    expect(result.current.data).toBe(before);
  });

  it('removes a job on DELETED with a resourceVersion equal to the cached job', async () => {
    const result = await setup(job('a', '8'), job('b', '9'));

    emit('DELETED', job('a', '8'));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(result.current.data?.items[0].metadata?.name).toBe('b');
  });

  it('skips a stale DELETED event older than the cached job', async () => {
    const result = await setup(job('a', '5'));

    emit('MODIFIED', job('a', '9', 'success'));
    await waitFor(() => expect(result.current.data?.items[0].metadata?.resourceVersion).toBe('9'));

    const before = result.current.data;
    // the job was re-created after this delete was emitted
    emit('DELETED', job('a', '4'));

    expect(result.current.data).toBe(before);
    expect(result.current.data?.items).toHaveLength(1);
  });
});
