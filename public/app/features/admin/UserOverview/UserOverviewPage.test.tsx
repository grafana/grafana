import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, within } from 'test/test-utils';

import { type Team, type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { locationService, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import UserOverviewPage from './UserOverviewPage';

setBackendSrv(backendSrv);
const server = setupMockServer();
const person: User = {
  metadata: {
    name: 'alice',
    labels: { 'grafana.app/deprecatedInternalID': '12' },
    creationTimestamp: '2026-01-01T00:00:00Z',
  },
  spec: {
    login: 'alice',
    title: 'Alice Example',
    email: 'alice@example.com',
    role: 'Viewer',
    provisioned: true,
    disabled: false,
    grafanaAdmin: false,
    emailVerified: true,
    externalAuthInfo: [{ module: 'oauth_grafana_com', authID: 'alice' }],
  },
  status: { lastSeenAt: 0 },
};
const team: Team = {
  metadata: { name: 'platform', labels: { 'grafana.app/deprecatedInternalID': '21' } },
  spec: { title: 'Platform', email: 'platform@example.com', provisioned: false, externalUID: '', members: [] },
};
const role = { uid: 'reader', name: 'custom:reader', displayName: 'Dashboard reader', description: 'Read dashboards' };

beforeEach(() => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  server.use(
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice', () => HttpResponse.json(person)),
    http.get('/api/users/12', () => HttpResponse.json({ authLabels: ['Grafana.com'] })),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice/teams', () =>
      HttpResponse.json({ items: [{ team: 'platform' }], metadata: {} })
    ),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/teams/platform', () => HttpResponse.json(team)),
    http.get('/api/access-control/users/12/roles', () => HttpResponse.json([role])),
    http.get('/api/access-control/teams/21/roles', () => HttpResponse.json([role]))
  );
});

afterEach(() => jest.restoreAllMocks());

function setup(tab = 'details') {
  return render(
    <Routes>
      <Route path="/admin/users/:uid" element={<UserOverviewPage />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/admin/users/alice?tab=${tab}`] },
    }
  );
}

it('shows read-only details and preserves never-logged-in semantics', async () => {
  setup();
  expect(await screen.findByText('Alice Example')).toBeInTheDocument();
  expect(await screen.findByText('Grafana.com')).toBeInTheDocument();
  expect(screen.getByText('Never')).toBeInTheDocument();
  expect(screen.getByText('Enabled')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('navigates between tabs and links to the team edit page', async () => {
  const { user } = setup();
  await screen.findByText('Alice Example');
  await user.click(screen.getByRole('tab', { name: 'Teams' }));
  expect(await screen.findByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/org/teams/edit/platform');
  expect(screen.getByText('platform@example.com')).toBeInTheDocument();
  expect(locationService.getLocation().search).toBe('?tab=teams');
});

it('shows basic, direct and inherited assignments in one table without losing duplicate sources', async () => {
  setup('roles');
  await screen.findByRole('link', { name: 'Platform' });
  const table = screen.getByRole('table');
  expect(within(table).getAllByText('Dashboard reader')).toHaveLength(2);
  expect(within(table).getByText('Viewer')).toBeInTheDocument();
  const inherited = within(table).getByText('Inherited from team').closest('tr')!;
  expect(within(inherited).getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/org/teams/edit/platform');
  expect(within(table).getByText('Directly assigned')).toBeInTheDocument();
});

it('loads all membership pages', async () => {
  server.use(
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice/teams', ({ request }) => {
      const next = new URL(request.url).searchParams.get('continue');
      return HttpResponse.json(
        next ? { items: [{ team: 'platform' }], metadata: {} } : { items: [], metadata: { continue: 'next-page' } }
      );
    })
  );
  setup('teams');
  expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument();
});

it('keeps basic and direct roles visible when team role access is denied', async () => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action) => action !== AccessControlAction.ActionTeamsRolesList);
  setup('roles');
  expect(await screen.findByText('Dashboard reader')).toBeInTheDocument();
  expect(screen.getByText('Viewer')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission');
});

it('reports a failed team-role request without hiding direct assignments', async () => {
  server.use(http.get('/api/access-control/teams/21/roles', () => new HttpResponse(null, { status: 403 })));
  setup('roles');
  expect(await screen.findByText('Some team roles could not be loaded')).toBeInTheDocument();
  expect(screen.getByText('Dashboard reader')).toBeInTheDocument();
});

it('shows an empty membership state', async () => {
  server.use(
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice/teams', () =>
      HttpResponse.json({ items: [], metadata: {} })
    )
  );
  setup('teams');
  expect(
    await screen.findByText('This user does not belong to any teams in the current organization.')
  ).toBeInTheDocument();
});
