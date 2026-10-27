import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouterStatusPage, routerStatusURL, type RouterStatus } from './RouterStatusPage';

const status: RouterStatus = {
  ready: false,
  reconciler: { phase: 'serving', last: '2026-10-26T10:00:00Z', lastFailed: true, total: 12, errors: 3 },
  breakers: { openAfterConsecutiveFailures: 5, openFor: '30s' },
  groups: [
    {
      group: 'dashboard.grafana.app',
      source: 'local',
      key: 'dash-key',
      health: 'unavailable',
      breaker: {
        scope: 'requests',
        state: 'open',
        requests: 9,
        successes: 4,
        failures: 5,
        consecutiveFailures: 5,
      },
      plugin: { id: 'my-plugin', version: '1.2.3', hasBackend: true },
      loadedAt: '2026-10-26T09:00:00Z',
      manifest: true,
      discovery: 'cached',
      openapiCached: ['v1', 'v2'],
      watches: 7,
    },
  ],
  loadFailures: [
    {
      group: 'broken.grafana.app',
      key: 'broken-key',
      failures: 4,
      since: '2026-10-26T08:00:00Z',
      retryAt: '2026-10-26T11:00:00Z',
      serving: false,
    },
  ],
};

const cloudStatus: RouterStatus = {
  ...status,
  ready: true,
  groups: [
    { ...status.groups[0], source: 'core_url', health: 'ok' },
    {
      ...status.groups[0],
      group: 'iam.grafana.app',
      key: 'st-key',
      source: 'single-tenant',
      health: 'unknown',
      breaker: { scope: 'per-destination', requests: 0, successes: 0, failures: 0, consecutiveFailures: 0 },
      plugin: undefined,
    },
  ],
  loadFailures: undefined,
  sources: [
    { source: 'single-tenant', lastSuccess: '0001-01-01T00:00:00Z', successes: 0, failures: 2, skipped: 1 },
    { source: 'core_url', lastSuccess: '2026-10-26T09:00:00Z', successes: 8, failures: 0, skipped: 0 },
  ],
  shadowed: [{ group: 'dashboard.grafana.app', source: 'single-tenant', servedBy: 'core_url' }],
  stackLookups: { error: 1, resolved: 40, cache_hit: 300 },
};

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows each group, load failure and source from the status endpoint', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(status)));
  render(<RouterStatusPage />);

  expect(await screen.findByText('dashboard.grafana.app')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(routerStatusURL, { cache: 'no-store' });

  expect(screen.getByText('Not ready')).toBeInTheDocument();
  expect(screen.getByText('Last reconcile failed')).toBeInTheDocument();
  expect(screen.getByText('unavailable')).toBeInTheDocument();
  expect(screen.getByText('5 (5 consecutive)')).toBeInTheDocument();
  expect(screen.getByText('my-plugin')).toBeInTheDocument();
  expect(screen.getByText('@1.2.3')).toBeInTheDocument();
  expect(screen.getByText('v1, v2')).toBeInTheDocument();
  expect(screen.getByText('broken.grafana.app')).toBeInTheDocument();
  expect(screen.queryByText('Shadowed groups')).not.toBeInTheDocument();
});

it('shows the HTTP error when the status cannot be loaded', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403, statusText: 'Forbidden' }));
  render(<RouterStatusPage />);

  expect(await screen.findByText('Unable to load router status')).toBeInTheDocument();
  expect(screen.getByText('HTTP 403 Forbidden')).toBeInTheDocument();
});

it('shows the cloud sources, shadowed groups and stack lookups', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  const sources = within((await screen.findByRole('heading', { name: 'Sources' })).parentElement!);
  const [stRow, coreRow] = sources.getAllByRole('row').slice(1);
  expect(within(stRow).getByText('never')).toBeInTheDocument();
  expect(within(coreRow).queryByText('never')).not.toBeInTheDocument();

  const shadowed = within(screen.getByRole('heading', { name: 'Shadowed groups' }).parentElement!);
  expect(within(shadowed.getAllByRole('row')[1]).getAllByText(/single-tenant|core_url/)).toHaveLength(2);

  const lookups = within(screen.getByRole('heading', { name: 'Stack lookups' }).parentElement!);
  expect(lookups.getAllByText(/^(resolved|cache hit|error)$/).map((el) => el.textContent)).toEqual([
    'resolved',
    'cache hit',
    'error',
  ]);
  expect(screen.getByText('1 ok')).toBeInTheDocument();
  // A group without a group breaker has no health badge, in the summary or its row.
  expect(screen.queryByText(/unknown/)).not.toBeInTheDocument();
});

it('filters groups by name or key', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  const groups = within((await screen.findByRole('heading', { name: 'Groups' })).parentElement!);
  await userEvent.type(screen.getByPlaceholderText('Filter by group, key or plugin'), 'st-key');

  expect(groups.getByText('iam.grafana.app')).toBeInTheDocument();
  expect(groups.queryByText('dashboard.grafana.app')).not.toBeInTheDocument();
  expect(screen.getByText('1 of 2')).toBeInTheDocument();
});

it('explains the discovery source, a missing breaker and the counted columns', async () => {
  const embedded: RouterStatus = {
    ...status,
    groups: [
      {
        ...status.groups[0],
        source: 'embedded',
        health: 'unknown',
        discovery: 'provided',
        breaker: { scope: 'none', requests: 0, successes: 0, failures: 0, consecutiveFailures: 0 },
        plugin: undefined,
      },
    ],
    loadFailures: undefined,
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(embedded)));
  render(<RouterStatusPage />);

  await userEvent.hover(await screen.findByText('provided'));
  expect(await screen.findByText(/supplied its resources when it loaded/)).toBeInTheDocument();

  await userEvent.hover(screen.getByText('none'));
  expect(await screen.findByText('Served in process, without a breaker')).toBeInTheDocument();
  expect(screen.queryByText(/single-tenant fallback keeps a breaker/)).not.toBeInTheDocument();

  await userEvent.hover(screen.getByText('Requests'));
  expect(await screen.findByText(/let through to the backend/)).toBeInTheDocument();
  await userEvent.hover(screen.getByText('Failures'));
  expect(await screen.findByText(/502, 503 and 504 responses/)).toBeInTheDocument();
});
