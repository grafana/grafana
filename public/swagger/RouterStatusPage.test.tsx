import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Badge, type BadgeColor } from '@grafana/ui';

import { RouterStatusPage, SourceBadge, routerStatusURL, type RouterStatus } from './RouterStatusPage';

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
      visibility: 'public',
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
    { ...status.groups[0], source: 'core', health: 'ok' },
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
    { source: 'core', lastSuccess: '2026-10-26T09:00:00Z', successes: 8, failures: 0, skipped: 0 },
  ],
  shadowed: [{ group: 'dashboard.grafana.app', source: 'single-tenant', servedBy: 'core' }],
  stackLookups: { error: 1, resolved: 40, cache_hit: 300 },
};

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
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
  expect(screen.queryByRole('tab', { name: /Stack lookups/ })).not.toBeInTheDocument();
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

  await userEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  const [stRow, coreRow] = screen.getAllByRole('row').slice(1);
  expect(within(stRow).getByText('never')).toBeInTheDocument();
  expect(within(coreRow).queryByText('never')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: /Stack lookups/ }));
  expect(screen.getAllByText(/^(resolved|cache hit|error)$/).map((el) => el.textContent)).toEqual([
    'resolved',
    'cache hit',
    'error',
  ]);
  await userEvent.click(screen.getByRole('tab', { name: /Groups/ }));
  const shadowed = within(screen.getByRole('heading', { name: 'Shadowed groups' }).parentElement!);
  expect(within(shadowed.getAllByRole('row')[1]).getAllByText(/single-tenant|core/)).toHaveLength(2);
  expect(screen.getByText('ok')).toBeInTheDocument();
  // A group without a group breaker has no health badge in its row.
  expect(screen.queryByText(/unknown/)).not.toBeInTheDocument();
});

it('keeps the selected tab in the URL', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(cloudStatus)));
  const { unmount } = render(<RouterStatusPage />);

  await userEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  expect(window.location.search).toBe('?tab=sources');
  unmount();

  render(<RouterStatusPage />);
  expect(await screen.findByText('never')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true');
});

it('counts the groups of each source and opens them filtered from the source row', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  await userEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  const [stRow] = screen.getAllByRole('row').slice(1);
  expect(within(stRow).getAllByRole('cell')[1]).toHaveTextContent('1');
  expect(within(stRow).getByRole('link')).toHaveAttribute('href', '/?tab=groups&source=single-tenant');

  await userEvent.click(within(stRow).getByText('single-tenant'));

  expect(window.location.search).toBe('?tab=groups&source=single-tenant');
  expect(screen.getByRole('tab', { name: /Groups/ })).toHaveAttribute('aria-selected', 'true');
  const groups = within((await screen.findAllByRole('table'))[0]);
  expect(groups.getByText('iam.grafana.app')).toBeInTheDocument();
  expect(groups.queryByText('dashboard.grafana.app')).not.toBeInTheDocument();
});

it('clears the source filter from the dropdown', async () => {
  const twoSources = {
    ...cloudStatus,
    groups: [...cloudStatus.groups, { ...cloudStatus.groups[1], group: 'other.grafana.app', source: 'plugins' }],
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(twoSources)));
  window.history.replaceState(null, '', '/?tab=groups&source=plugins');
  render(<RouterStatusPage />);

  const groups = within((await screen.findAllByRole('table'))[0]);
  expect(groups.getByText('other.grafana.app')).toBeInTheDocument();
  expect(groups.queryByText('iam.grafana.app')).not.toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Clear value'));

  expect(groups.getByText('iam.grafana.app')).toBeInTheDocument();
  expect(window.location.search).toBe('?tab=groups');
});

it('sorts sources by group count by default and sorts a table by its column header', async () => {
  const twoSources = {
    ...cloudStatus,
    groups: [...cloudStatus.groups, { ...cloudStatus.groups[1], group: 'a.grafana.app' }],
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(twoSources)));
  render(<RouterStatusPage />);

  const sourceNames = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0].textContent);
  await userEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  expect(sourceNames()).toEqual(['single-tenant', 'core']);

  await userEvent.click(screen.getByRole('button', { name: 'Source' }));
  expect(sourceNames()).toEqual(['core', 'single-tenant']);
  await userEvent.click(screen.getByRole('button', { name: 'Source' }));
  expect(sourceNames()).toEqual(['single-tenant', 'core']);
  expect(screen.getByRole('columnheader', { name: 'Source' })).toHaveAttribute('aria-sort', 'descending');
});

it('adds each tab or source change to the browser history', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  await userEvent.click(await screen.findByRole('tab', { name: /Sources/ }));
  await userEvent.click(within(screen.getAllByRole('row')[1]).getByText('single-tenant'));
  expect(window.location.search).toBe('?tab=groups&source=single-tenant');

  act(() => window.history.back());
  await waitFor(() => expect(window.location.search).toBe('?tab=sources'));
  await waitFor(() => expect(screen.getByRole('tab', { name: /Sources/ })).toHaveAttribute('aria-selected', 'true'));
});

// Clicks the link and reports whether the browser is left to follow it. jsdom cannot navigate, and says
// so, which is how a followed link shows up.
async function followed(el: HTMLElement, init: MouseEventInit) {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const notPrevented = fireEvent.click(el, init);
  // jsdom reports the navigation later; settle before judging, and before the next test
  await new Promise((resolve) => setTimeout(resolve, 0));
  const navigated = error.mock.calls.some(([e]) => String(e).includes('Not implemented: navigation'));
  error.mockRestore();
  return notPrevented && navigated;
}

it('links the tabs and sources, and leaves a modified click to the browser', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  const sourcesTab = await screen.findByRole('tab', { name: /Sources/ });
  expect(sourcesTab).toHaveAttribute('href', '/?tab=sources');

  expect(await followed(sourcesTab, { metaKey: true })).toBe(true);
  expect(window.location.search).toBe('');
  expect(screen.getByRole('tab', { name: /Groups/ })).toHaveAttribute('aria-selected', 'true');

  await userEvent.click(sourcesTab);
  const link = within(screen.getAllByRole('row')[1]).getByRole('link');
  expect(await followed(link, { ctrlKey: true })).toBe(true);
  expect(window.location.search).toBe('?tab=sources');
});

it('lists the groups with the most requests first', async () => {
  const busy = {
    ...cloudStatus,
    groups: [
      {
        ...cloudStatus.groups[0],
        group: 'quiet.grafana.app',
        breaker: { ...cloudStatus.groups[0].breaker, requests: 1 },
      },
      {
        ...cloudStatus.groups[0],
        group: 'busy.grafana.app',
        breaker: { ...cloudStatus.groups[0].breaker, requests: 90 },
      },
    ],
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(busy)));
  render(<RouterStatusPage />);

  const groups = within((await screen.findAllByRole('table'))[0]);
  expect(
    groups
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0].textContent)
  ).toEqual(['busy.grafana.app', 'quiet.grafana.app']);
});

it('filters groups by name or key', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  const groups = within((await screen.findAllByRole('table'))[0]);
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

it('marks the groups only access policies see', async () => {
  const internal: RouterStatus = {
    ...status,
    groups: [
      { ...status.groups[0], group: 'mobile.ext.grafana.app', visibility: 'internal' },
      { ...status.groups[0], group: 'widgets.ext.grafana.app', visibility: 'public' },
    ],
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(internal)));
  render(<RouterStatusPage />);

  const internalRow = (await screen.findByText('mobile.ext.grafana.app')).closest('tr')!;
  const publicRow = screen.getByText('widgets.ext.grafana.app').closest('tr')!;
  expect(within(publicRow).queryByText('internal')).not.toBeInTheDocument();

  await userEvent.hover(within(internalRow).getByText('internal'));
  expect(await screen.findByText(/Only access policies see this group/)).toBeInTheDocument();
});

it.each<[string, BadgeColor]>([
  ['aggregate:custom', 'blue'],
  ['single-tenant', 'purple'],
  ['core', 'brand'],
  ['plugins', 'green'],
  ['bridge', 'orange'],
  ['dev', 'darkgrey'],
])('colors the %s source badge %s', (source, color) => {
  render(
    <>
      <SourceBadge source={source} />
      <Badge color={color} text="reference" />
    </>
  );

  // Emotion derives the class from the styles, so the same color gives the same class
  expect(screen.getByText(source).className).toBe(screen.getByText('reference').className);
});

it('gives the manifests sources distinct badge colors', () => {
  render(
    <>
      {['core', 'plugins', 'bridge'].map((source) => (
        <SourceBadge key={source} source={source} />
      ))}
    </>
  );

  const classes = ['core', 'plugins', 'bridge'].map((source) => screen.getByText(source).className);
  expect(new Set(classes).size).toBe(3);
});
