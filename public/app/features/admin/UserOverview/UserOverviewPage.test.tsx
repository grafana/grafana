import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, within, waitFor } from 'test/test-utils';

import { type Team, type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { locationService, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

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
const profile: UserDTO = {
  id: 12,
  uid: 'alice',
  login: 'alice',
  name: 'Alice Example',
  email: 'alice@example.com',
  isGrafanaAdmin: false,
  isDisabled: false,
  isProvisioned: false,
  authLabels: ['Grafana.com'],
  accessControl: {},
};

beforeEach(() => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  server.use(
    http.get('/apis', () =>
      HttpResponse.json({
        items: [
          {
            metadata: { name: 'iam.grafana.app' },
            versions: [
              {
                version: 'v0alpha1',
                resources: [
                  {
                    resource: 'users',
                    responseKind: { kind: 'User' },
                    verbs: ['get'],
                    subresources: [{ subresource: 'teams', responseKind: { kind: 'UserTeam' }, verbs: ['get'] }],
                  },
                  { resource: 'teams', responseKind: { kind: 'Team' }, verbs: ['get'] },
                ],
              },
            ],
          },
        ],
      })
    ),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice', () => HttpResponse.json(person)),
    http.get('/api/users/alice', () => HttpResponse.json(profile)),
    http.get('/api/users/alice/orgs', () => HttpResponse.json([{ orgId: 1, name: 'Main Org.', role: 'Viewer' }])),
    http.get('/api/org/users', () => HttpResponse.json([])),
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
      <Route path="/admin/users/edit/:id" element={<UserOverviewPage />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/admin/users/edit/alice?tab=${tab}`] },
    }
  );
}

it('shows read-only details and preserves never-logged-in semantics', async () => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation(
      (action) => action === AccessControlAction.UsersRead || action === AccessControlAction.OrgUsersRead
    );
  setup();
  expect(await screen.findByText('Alice Example')).toBeInTheDocument();
  expect(await screen.findByText('Grafana.com')).toBeInTheDocument();
  expect(screen.getByText('Never')).toBeInTheDocument();
  expect(screen.getByText('Enabled')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Sessions' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Disable user' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable user' })).not.toBeInTheDocument();
});

it('confirms account disabling and refreshes the available actions', async () => {
  let saved = {
    ...profile,
    accessControl: { [AccessControlAction.UsersDisable]: true, [AccessControlAction.UsersEnable]: true },
  };
  const disable = jest.fn();
  server.use(
    http.get('/api/users/alice', () => HttpResponse.json(saved)),
    http.post('/api/admin/users/alice/disable', () => {
      disable();
      saved = { ...saved, isDisabled: true };
      return HttpResponse.json({ message: 'User disabled' });
    })
  );
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: 'Disable user' }));
  expect(disable).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable user' }));
  expect(await screen.findByRole('button', { name: 'Enable user' })).toBeInTheDocument();
  expect(disable).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Disabled')).toBeInTheDocument();
});

it('cancels account deletion without sending a request and restores focus', async () => {
  const remove = jest.fn();
  server.use(
    http.get('/api/users/alice', () =>
      HttpResponse.json({ ...profile, accessControl: { [AccessControlAction.UsersDelete]: true } })
    ),
    http.delete('/api/admin/users/alice', () => {
      remove();
      return HttpResponse.json({ message: 'User deleted' });
    })
  );
  const { user } = setup();
  const trigger = await screen.findByRole('button', { name: 'Delete user' });
  await user.click(trigger);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(remove).not.toHaveBeenCalled();
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

it('allows profile edits with user-specific write permission and refreshes saved data', async () => {
  let saved = { ...profile, accessControl: { [AccessControlAction.UsersWrite]: true } };
  const updates = jest.fn();
  server.use(
    http.get('/api/users/alice', () => HttpResponse.json(saved)),
    http.put('/api/users/alice', async ({ request }) => {
      const body = await request.json();
      updates(body);
      saved = { ...saved, name: 'Alice Updated' };
      return HttpResponse.json({ message: 'User updated' });
    })
  );
  const { user } = setup();
  await screen.findByText('Alice Example');
  await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
  await user.clear(screen.getByRole('textbox', { name: 'Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Alice Updated');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(updates).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice Updated' })));
  expect(await screen.findByText('Alice Updated')).toBeInTheDocument();
});

it('keeps a failed profile edit open and allows retrying the mutation', async () => {
  let saved = { ...profile, accessControl: { [AccessControlAction.UsersWrite]: true } };
  let attempts = 0;
  server.use(
    http.get('/api/users/alice', () => HttpResponse.json(saved)),
    http.put('/api/users/alice', () => {
      if (++attempts === 1) {
        return HttpResponse.json({ message: 'Update failed' }, { status: 500 });
      }
      saved = { ...saved, name: 'Alice Updated' };
      return HttpResponse.json({ message: 'User updated' });
    })
  );
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
  await user.clear(screen.getByRole('textbox', { name: 'Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Alice Updated');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Unable to update user. Please try again.')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Alice Updated');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Alice Updated')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
});

it.each([{ isExternal: true }, { isProvisioned: true }])(
  'locks externally managed profile fields: %j',
  async (flags) => {
    server.use(
      http.get('/api/users/alice', () =>
        HttpResponse.json({
          ...profile,
          ...flags,
          accessControl: {
            [AccessControlAction.UsersWrite]: true,
            [AccessControlAction.UsersPasswordUpdate]: true,
          },
        })
      )
    );
    setup();
    await screen.findByText('Numerical identifier');
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  }
);

it('loads sessions only on their tab and allows individual revocation without logout-all permission', async () => {
  const requests = jest.fn();
  jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action !== AccessControlAction.UsersLogout);
  server.use(
    http.get('/api/admin/users/alice/auth-tokens', () => {
      requests();
      return HttpResponse.json([
        {
          id: 1,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          seenAt: '2026-01-01T00:00:00Z',
          clientIp: '127.0.0.1',
          browser: 'Firefox',
          os: 'Linux',
          osVersion: '',
        },
      ]);
    })
  );
  const { user } = setup();
  await screen.findByText('Numerical identifier');
  expect(requests).not.toHaveBeenCalled();
  await user.click(screen.getByRole('tab', { name: 'Sessions' }));
  expect(await screen.findByText('127.0.0.1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Force logout' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Force logout from all devices' })).not.toBeInTheDocument();
});

it('keeps the existing profile accessible when the IAM API is unavailable', async () => {
  server.use(
    http.get('/apis', () => HttpResponse.json({ items: [] })),
    http.get('/api/users/alice/orgs', () => HttpResponse.json([{ orgId: 1, name: 'Main Org.', role: 'Viewer' }]))
  );
  setup();
  expect(await screen.findByText('Numerical identifier')).toBeInTheDocument();
  expect(screen.getByText('Alice Example')).toBeInTheDocument();
});

it('updates the basic role from the Roles tab and refreshes the table', async () => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
  let basicRole = 'Viewer';
  const updates = jest.fn();
  server.use(
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice', () =>
      HttpResponse.json({ ...person, spec: { ...person.spec, role: basicRole } })
    ),
    http.patch('/api/org/users/12', async ({ request }) => {
      updates(await request.json());
      basicRole = 'Editor';
      return HttpResponse.json({ message: 'Role updated' });
    })
  );
  const { user } = setup('roles');
  await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
  await user.click(screen.getByRole('combobox', { name: 'Basic role' }));
  await user.click(screen.getByText('Editor'));
  await waitFor(() => expect(updates).toHaveBeenCalledWith({ role: 'Editor' }));
  await waitFor(() => expect(within(screen.getByRole('table')).getByText('Editor')).toBeInTheDocument());
});

it('does not offer role editing without write permissions', async () => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action) => !['org.users:write', 'users.roles:add', 'users.roles:remove'].includes(action));
  setup('roles');
  await screen.findByRole('link', { name: 'Platform' });
  expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
});

it('uses legacy teams when discovery does not advertise the membership API', async () => {
  const iamRequests = jest.fn();
  server.use(
    http.get('/apis', () => HttpResponse.json({ items: [] })),
    http.get('/api/users/alice/teams', () =>
      HttpResponse.json([{ id: 21, uid: 'platform', name: 'Platform', email: 'platform@example.com' }])
    ),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice', () => {
      iamRequests();
      return HttpResponse.json(person);
    }),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice/teams', () => {
      iamRequests();
      return HttpResponse.json({ items: [] });
    })
  );
  const { user } = setup('teams');
  expect(await screen.findByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/org/teams/edit/platform');
  expect(screen.getByText('platform@example.com')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Roles' }));
  expect(await screen.findByText('Inherited from team')).toBeInTheDocument();
  expect(screen.getAllByText('Dashboard reader')).toHaveLength(2);
  expect(iamRequests).not.toHaveBeenCalled();
});

it('uses organization user data on older servers without requiring global user read', async () => {
  const profileRequests = jest.fn();
  jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action === AccessControlAction.OrgUsersRead);
  server.use(
    http.get('/apis', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/org/users', () => HttpResponse.json([{ ...profile, userId: 12, role: 'Viewer', orgId: 1 }])),
    http.get('/api/users/alice', () => {
      profileRequests();
      return new HttpResponse(null, { status: 403 });
    })
  );
  setup();
  expect(await screen.findByText('Alice Example')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  expect(profileRequests).not.toHaveBeenCalled();
});

it.each([403, 500])('does not switch to legacy data when IAM returns %s', async (status) => {
  server.use(
    http.get(
      '/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice',
      () => new HttpResponse(null, { status })
    )
  );
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    status === 403 ? 'You do not have permission' : 'Unable to load'
  );
  expect(screen.queryByText('Alice Example')).not.toBeInTheDocument();
});

it('supports IAM user reads alongside legacy team membership reads', async () => {
  server.use(
    http.get('/apis', () =>
      HttpResponse.json({
        items: [
          {
            metadata: { name: 'iam.grafana.app' },
            versions: [
              {
                version: 'v0alpha1',
                resources: [{ resource: 'users', responseKind: { kind: 'User' }, verbs: ['get'] }],
              },
            ],
          },
        ],
      })
    ),
    http.get('/api/users/alice/teams', () => HttpResponse.json([{ id: 21, uid: 'platform', name: 'Platform' }]))
  );
  const { user } = setup();
  expect(await screen.findByText('Never')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Teams' }));
  expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument();
});

it('does not offer basic-role editing for a provisioned user', async () => {
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
  server.use(http.get('/api/users/alice', () => HttpResponse.json({ ...profile, isProvisioned: true })));
  setup('roles');
  await screen.findByText('Viewer');
  await screen.findByRole('tab', { name: 'Organizations' });
  expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
});

it('sorts teams by their displayed name in both directions', async () => {
  server.use(
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/alice/teams', () =>
      HttpResponse.json({ items: [{ team: 'platform' }, { team: 'analytics' }], metadata: {} })
    ),
    http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/teams/analytics', () =>
      HttpResponse.json({ ...team, metadata: { name: 'analytics' }, spec: { ...team.spec, title: 'Analytics' } })
    )
  );
  const { user } = setup('teams');
  await screen.findByRole('link', { name: 'Analytics' });
  const header = screen.getByRole('columnheader', { name: 'Team name' });
  await user.click(within(header).getByRole('button'));
  expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(within(screen.getAllByRole('row')[1]).getByRole('link')).toHaveTextContent('Analytics');
  await user.click(within(header).getByRole('button'));
  expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(within(screen.getAllByRole('row')[1]).getByRole('link')).toHaveTextContent('Platform');
});

it('sorts role assignments by the displayed assignment type', async () => {
  const { user } = setup('roles');
  await screen.findByRole('link', { name: 'Platform' });
  await user.click(screen.getByRole('button', { name: 'Assignment type' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Basic role');
  await user.click(screen.getByRole('button', { name: 'Assignment type' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Inherited from team');
});

it('sorts sessions by timestamps rather than relative date labels', async () => {
  server.use(
    http.get('/api/admin/users/alice/auth-tokens', () =>
      HttpResponse.json([
        {
          id: 1,
          seenAt: '2026-01-01T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          clientIp: '10.0.0.1',
          browser: 'Firefox',
          os: 'Linux',
          osVersion: '',
        },
        {
          id: 2,
          seenAt: '2025-12-01T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          clientIp: '10.0.0.2',
          browser: 'Firefox',
          os: 'Linux',
          osVersion: '',
        },
      ])
    )
  );
  const { user } = setup('sessions');
  await screen.findByText('10.0.0.1');
  await user.click(screen.getByRole('button', { name: 'Last seen' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('10.0.0.2');
  await user.click(screen.getByRole('button', { name: 'Last seen' }));
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('10.0.0.1');
});
