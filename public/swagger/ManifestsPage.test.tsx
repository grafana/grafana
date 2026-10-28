import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AppManifest, ManifestsPage, manifestsURL } from './ManifestsPage';
import { routerStatusURL } from './RouterStatusPage';

const dashboards: AppManifest = {
  metadata: { name: 'dashboard.grafana.app' },
  spec: {
    appName: 'dashboard',
    appDisplayName: 'Dashboards',
    group: 'dashboard.grafana.app',
    preferredVersion: 'v1',
    versions: [
      { name: 'v0alpha1', served: false, kinds: [{ kind: 'Dashboard', scope: 'Namespaced' }] },
      {
        name: 'v1',
        kinds: [
          {
            kind: 'Dashboard',
            scope: 'Namespaced',
            admission: { validation: { operations: ['CREATE', 'UPDATE'] } },
            conversion: true,
            search: { hybrid: true },
            routes: { '/dto': {} },
          },
          { kind: 'LibraryPanel', plural: 'librarypanels', scope: 'Namespaced', folderScoped: false },
        ],
        openapi: { paths: { '/namespaces/{namespace}/search': {}, '/namespaces/{namespace}/snapshots': {} } },
      },
    ],
    roles: { 'dashboard:reader': { title: 'Dashboard reader', description: 'Read dashboards' } },
  },
};

const iam: AppManifest = {
  metadata: { name: 'iam.grafana.app' },
  spec: {
    appName: 'iam',
    appDisplayName: '',
    group: 'iam.grafana.app',
    versions: [{ name: 'v0alpha1', kinds: [{ kind: 'User', scope: 'Cluster', userReadable: true }] }],
  },
};

// The served OpenAPI document for dashboard.grafana.app/v1, with the operation IDs the API server assigns
const dashboardOpenAPI = {
  paths: {
    '/apis/dashboard.grafana.app/v1/namespaces/{namespace}/search': {
      get: { operationId: 'getSearch', tags: ['Search API'] },
    },
    '/apis/dashboard.grafana.app/v1/namespaces/{namespace}/snapshots': {
      get: { operationId: 'getSnapshots' },
      post: { operationId: 'createSnapshots' },
    },
    '/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards': {
      get: { operationId: 'listDashboard', tags: ['Dashboard'] },
    },
    '/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{name}/dto': {
      get: { operationId: 'getDashboardDto', tags: ['Dashboard'] },
    },
  },
};

// Only dashboards has a router status, so iam shows none
const routerStatus = {
  groups: [{ group: 'dashboard.grafana.app', health: 'degraded', source: 'core_url', key: 'dash-key' }],
};

function mockManifests(items: AppManifest[]) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    switch (url) {
      case manifestsURL:
        return new Response(JSON.stringify({ kind: 'AppManifestList', items }));
      case routerStatusURL:
        return new Response(JSON.stringify(routerStatus));
      case 'openapi/v3/apis/dashboard.grafana.app/v1':
        return new Response(JSON.stringify(dashboardOpenAPI));
    }
    return new Response('not found', { status: 404 });
  });
}

const rowFor = (group: string) => screen.getByText(group).closest('tr')!;

afterEach(() => {
  jest.restoreAllMocks();
});

it('summarizes each manifest from its preferred version', async () => {
  const fetch = mockManifests([dashboards, iam]);
  render(<ManifestsPage />);

  expect(await screen.findByText('dashboard.grafana.app')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(manifestsURL, { cache: 'no-store' });

  const dash = within(rowFor('dashboard.grafana.app'));
  expect(dash.getByText('Dashboards')).toBeInTheDocument();
  expect(dash.getByText('dashboard')).toBeInTheDocument();
  expect(dash.getByText('v0alpha1')).toHaveStyle({ textDecoration: 'line-through' });
  expect(dash.getAllByRole('cell').map((c) => c.textContent)).toEqual(expect.arrayContaining(['2', '2', '1']));
  expect(await dash.findByText('degraded')).toBeInTheDocument();
  expect(dash.getByText('core_url')).toBeInTheDocument();
  for (const cap of ['validation', 'conversion', 'hybrid search']) {
    expect(dash.getByText(cap)).toBeInTheDocument();
  }
  expect(dash.queryByText('mutation')).not.toBeInTheDocument();
  expect(dash.getByText('API docs')).toHaveAttribute('href', 'swagger?api=dashboard.grafana.app-v1');
  expect(dash.getByText('JSON')).toHaveAttribute('href', `${manifestsURL}/dashboard.grafana.app`);

  // Without a preferred version, the last version is preferred; without a display name, the app name shows
  const user = within(rowFor('iam.grafana.app'));
  expect(user.getByText('iam')).toBeInTheDocument();
  expect(user.queryByText('core_url')).not.toBeInTheDocument();
  expect(user.getByText('API docs')).toHaveAttribute('href', 'swagger?api=iam.grafana.app-v0alpha1');
});

it('shows each version with its kinds, routes and roles when expanded', async () => {
  mockManifests([dashboards]);
  render(<ManifestsPage />);

  await userEvent.click(await screen.findByText('dashboard.grafana.app'));

  const kindRows = screen
    .getAllByRole('row')
    .filter((r) => ['Dashboard', 'LibraryPanel'].includes(r.firstElementChild?.textContent ?? ''));
  const [v0Dashboard, v1Dashboard, libraryPanel] = kindRows.map((r) => within(r));
  expect(v0Dashboard.getByText('dashboards')).toBeInTheDocument();
  expect(v1Dashboard.getByText('validate: CREATE, UPDATE')).toBeInTheDocument();
  expect(v1Dashboard.getByText('search, trash, hybrid')).toBeInTheDocument();
  expect(v1Dashboard.getByText('folder scoped')).toBeInTheDocument();
  expect(v1Dashboard.getByText('/dto')).toBeInTheDocument();
  expect(libraryPanel.getByText('librarypanels')).toBeInTheDocument();
  expect(libraryPanel.queryByText('folder scoped')).not.toBeInTheDocument();

  await waitFor(() => expect(screen.getAllByText('/namespaces/{namespace}/snapshots')).toHaveLength(2));
  expect(screen.getByText('Dashboard reader')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  expect(screen.queryByText('/namespaces/{namespace}/snapshots')).not.toBeInTheDocument();
});

it('links each route and subresource to its operation in the API docs', async () => {
  mockManifests([dashboards]);
  render(<ManifestsPage />);

  await userEvent.click(await screen.findByText('dashboard.grafana.app'));

  const hrefs = (text: string) => screen.getAllByText(text).map((el) => el.closest('a')?.getAttribute('href'));
  const docs = 'swagger?api=dashboard.grafana.app-v1#';
  await waitFor(() => expect(hrefs('/namespaces/{namespace}/search')).toEqual([`${docs}/Search%20API/getSearch`]));
  expect(hrefs('/namespaces/{namespace}/snapshots')).toEqual([
    `${docs}/default/getSnapshots`,
    `${docs}/default/createSnapshots`,
  ]);
  // v0alpha1 is not served, so only v1 has the subresource
  expect(hrefs('/dto')).toEqual([`${docs}/Dashboard/getDashboardDto`]);

  // Kinds link to their section, found from their collection operations; LibraryPanel has none
  expect(hrefs('Dashboard')).toEqual([undefined, `${docs}/Dashboard`]);
  expect(hrefs('LibraryPanel')).toEqual([undefined]);
});

it('filters manifests by kind', async () => {
  mockManifests([dashboards, iam]);
  render(<ManifestsPage />);

  await userEvent.type(await screen.findByPlaceholderText('Filter by group, app or kind'), 'user');

  expect(screen.getByText('iam.grafana.app')).toBeInTheDocument();
  expect(screen.queryByText('dashboard.grafana.app')).not.toBeInTheDocument();
  expect(screen.getByText('1 of 2')).toBeInTheDocument();
});

it('shows the HTTP error when the manifests cannot be loaded', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('denied', { status: 403, statusText: 'Forbidden' }));
  render(<ManifestsPage />);

  expect(await screen.findByText('Unable to load manifests')).toBeInTheDocument();
  expect(screen.getByText('HTTP 403 Forbidden')).toBeInTheDocument();
});
