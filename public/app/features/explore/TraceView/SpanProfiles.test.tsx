import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';

import { getBackendSrv, getDataSourceInstanceList } from '@grafana/runtime';

import { SpanProfilesProvider, TraceProfilesButton, profileScope } from './SpanProfiles';
import { type TraceSpan } from './components/types/trace';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getDataSourceInstanceList: jest.fn(),
}));

const span = {
  spanID: 'c1c6eacc0eadd9bd',
  traceID: 'e166bc89db0705dc00010abceb01d085',
  processID: 'p1',
  startTime: 100000000,
  duration: 1000000,
  tags: [],
  process: {
    serviceName: 'pyroscope-compaction-worker',
    tags: [
      { key: 'k8s.container.name', value: 'compaction-worker' },
      { key: 'k8s.deployment.name', value: 'compaction-worker' },
      { key: 'k8s.namespace.name', value: 'fire-dev-001' },
      { key: 'k8s.cluster.name', value: 'dev-us-central-0' },
    ],
  },
} as TraceSpan;

it('maps all four workload attributes and rejects incomplete scopes', () => {
  expect(profileScope(span)).toEqual({
    container: 'compaction-worker',
    workload: 'compaction-worker',
    namespace: 'fire-dev-001',
    cluster: 'dev-us-central-0',
  });
  expect(profileScope({ ...span, process: { ...span.process, tags: [] } })).toBeUndefined();
});

it('prefers KG mappings, discovers zero-total profiles, and jumps using the native callback', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({ rows: [['fire-dev-001/compaction-worker']] })
    .mockResolvedValueOnce({
      spans: [
        {
          spanId: span.spanID,
          traceId: span.traceID,
          totals: [{ profileTypeID: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds', total: '0' }],
        },
      ],
    });
  jest.mocked(getBackendSrv).mockReturnValue({ post } as unknown as ReturnType<typeof getBackendSrv>);
  jest
    .mocked(getDataSourceInstanceList)
    .mockResolvedValue([{ uid: 'grafanacloud-profiles' }] as Awaited<ReturnType<typeof getDataSourceInstanceList>>);
  const onGoToSpan = jest.fn();
  render(
    <SpanProfilesProvider
      spans={[span]}
      traceId={span.traceID}
      options={{ datasourceUid: 'grafanacloud-profiles' }}
      onGoToSpan={onGoToSpan}
    >
      <TraceProfilesButton />
    </SpanProfilesProvider>
  );
  const button = screen.getByRole('button', { name: /Profiles for this trace/ });
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(button);
  const item = await screen.findByRole('menuitem', { name: /pyroscope-compaction-worker/ });
  await act(async () => {
    fireEvent.click(item);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(onGoToSpan).toHaveBeenCalledWith(span.spanID);
  expect(post.mock.calls[1][1]).toMatchObject({
    labelSelector: '{service_name="fire-dev-001/compaction-worker"}',
    spanSelector: [span.spanID],
    start: '40000',
    end: '161000',
  });
});

it('falls back to configured mapping when KG fails', async () => {
  const post = jest.fn().mockRejectedValueOnce(new Error('KG unavailable')).mockResolvedValueOnce({});
  jest.mocked(getBackendSrv).mockReturnValue({ post } as unknown as ReturnType<typeof getBackendSrv>);
  jest
    .mocked(getDataSourceInstanceList)
    .mockResolvedValue([{ uid: 'profiles' }] as Awaited<ReturnType<typeof getDataSourceInstanceList>>);
  render(
    <SpanProfilesProvider
      spans={[span]}
      traceId={span.traceID}
      options={{ datasourceUid: 'profiles', tags: [{ key: 'k8s.namespace.name', value: 'namespace' }] }}
      onGoToSpan={jest.fn()}
    />
  );
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[1][1].labelSelector).toContain('fire-dev-001');
});
