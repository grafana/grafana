import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { act, render, screen, within, waitFor } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { locationService, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import config from 'app/core/config';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type OrgUser, type UserDTO } from 'app/types/user';

import UserOverviewPage from './UserOverviewPage';

setBackendSrv(backendSrv);
const server = setupMockServer();

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
  createdAt: '2020-01-01T00:00:00Z',
  accessControl: {},
};
// Last seen before creation: the backend's way of saying the user never signed in.
const member: OrgUser = {
  orgId: 1,
  userId: 12,
  uid: 'alice',
  login: 'alice',
  name: 'Alice Example',
  email: 'alice@example.com',
  avatarUrl: '',
  role: OrgRole.Viewer,
  created: '2020-01-01T00:00:00Z',
  lastSeenAt: '2010-01-01T00:00:00Z',
  lastSeenAtAge: '10 years',
  isDisabled: false,
  authLabels: [],
  isExternallySynced: false,
  isProvisioned: false,
  accessControl: {},
};
const editableMember = { ...member, accessControl: { [AccessControlAction.OrgUsersWrite]: true } };
const role = { uid: 'reader', name: 'custom:reader', displayName: 'Dashboard reader', description: 'Read dashboards' };
const platform = { id: 21, uid: 'platform', name: 'Platform', email: 'platform@example.com' };
const sessions = [
  { id: 1, seenAt: '2026-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', clientIp: '10.0.0.1' },
  { id: 2, seenAt: '2025-12-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', clientIp: '10.0.0.2' },
].map((session) => ({ ...session, isActive: false, browser: 'Firefox', os: 'Linux', osVersion: '' }));

beforeEach(() => {
  document.addEventListener('click', interceptLinkClicks);
  jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  // A signed-in user always has an organization, and the role picker reads nothing without one.
  jest.replaceProperty(contextSrv.user, 'orgId', 1);
  server.use(
    http.get('/api/users/alice', () => HttpResponse.json(profile)),
    http.get('/api/org/users', () => HttpResponse.json([member])),
    http.get('/api/users/alice/orgs', () => HttpResponse.json([{ orgId: 1, name: 'Main Org.', role: 'Viewer' }])),
    http.get('/api/users/alice/teams', () => HttpResponse.json([platform])),
    http.get('/api/access-control/users/12/roles', () => HttpResponse.json([role])),
    http.post('/api/access-control/teams/roles/search', () => HttpResponse.json({ 21: [role] }))
  );
});

afterEach(() => {
  document.removeEventListener('click', interceptLinkClicks);
  setTestFlags();
  jest.restoreAllMocks();
});

function setup(tab = 'details', id = 'alice') {
  return render(
    <Routes>
      <Route path="/admin/users/edit/:id/:page?" element={<UserOverviewPage />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/admin/users/edit/${id}${tab === 'details' ? '' : `/${tab}`}`] },
    }
  );
}

function withAccess(...actions: AccessControlAction[]) {
  return { ...profile, accessControl: Object.fromEntries(actions.map((action) => [action, true])) };
}

describe('user details', () => {
  it('shows read-only details and marks a user who never signed in', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action) => action === AccessControlAction.UsersRead || action === AccessControlAction.OrgUsersRead
      );
    setup();
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Origin Grafana.com' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Status Enabled' })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: 'Last active Never' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Delete|Disable|Enable) user$/ })).not.toBeInTheDocument();
  });

  it('shows when the user was last active', async () => {
    server.use(
      http.get('/api/org/users', () => HttpResponse.json([{ ...member, lastSeenAt: '2020-06-01T12:00:00Z' }]))
    );
    setup();
    expect(await screen.findByRole('row', { name: /^Last active \d+ years ago \(2020-06-01/ })).toBeInTheDocument();
  });

  it('shows an organization-only reader the member details without requesting the profile', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action === AccessControlAction.OrgUsersRead);
    const profileRequests = jest.fn();
    server.use(
      http.get('/api/org/users', () => HttpResponse.json([{ ...member, authLabels: null }])),
      http.get('/api/users/alice', () => {
        profileRequests();
        return new HttpResponse(null, { status: 403 });
      })
    );
    setup();
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Origin Grafana' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Roles' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(profileRequests).not.toHaveBeenCalled();
  });

  it('requests the membership by exact user UID, without waiting for the profile', async () => {
    const lookups = jest.fn();
    server.use(
      http.get('/api/users/alice', async () => {
        await delay('infinite');
        return HttpResponse.json(profile);
      }),
      http.get('/api/org/users', ({ request }) => {
        lookups(new URL(request.url).search);
        return HttpResponse.json([member]);
      })
    );
    setup();
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(lookups.mock.calls).toEqual([['?userUid=alice&limit=1&accesscontrol=true']]);
  });

  it('requests the membership by numerical ID when the address holds one', async () => {
    const lookups = jest.fn();
    server.use(
      http.get('/api/users/12', () => HttpResponse.json(profile)),
      http.get('/api/org/users', ({ request }) => {
        const { search, searchParams } = new URL(request.url);
        lookups(search);
        return HttpResponse.json(searchParams.get('userId') === '12' ? [member] : []);
      })
    );
    setup('roles', '12');
    expect(await screen.findByText('Basic role')).toBeInTheDocument();
    expect(lookups.mock.calls).toEqual([['?userId=12&limit=1&accesscontrol=true']]);
  });

  it('reports the membership as unknown when the server ignores the user filter', async () => {
    server.use(http.get('/api/org/users', () => HttpResponse.json([{ ...member, uid: 'someone-else', userId: 99 }])));
    setup();
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
  });

  it.each([
    [403, 'You do not have permission'],
    [500, 'Unable to load'],
  ])('keeps the account visible and shows the membership error when the lookup returns %s', async (status, message) => {
    server.use(http.get('/api/org/users', () => new HttpResponse(null, { status })));
    const { user } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Roles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('keeps the organization membership visible when the account request fails', async () => {
    server.use(http.get('/api/users/alice', () => new HttpResponse(null, { status: 403 })));
    setup();
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Last active Never' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  });

  it('allows profile edits with user-specific write permission and refreshes saved data', async () => {
    let saved = withAccess(AccessControlAction.UsersWrite);
    const updates = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(saved)),
      http.put('/api/users/alice', async ({ request }) => {
        updates(await request.json());
        saved = { ...saved, name: 'Alice Saved' };
        return HttpResponse.json({ message: 'User updated' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Alice Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // The server's version of the name replaces the typed one once the refetch lands.
    expect(await screen.findByRole('row', { name: 'Name Alice Saved Edit' })).toBeInTheDocument();
    expect(updates).toHaveBeenCalledWith({ login: 'alice', name: 'Alice Updated', email: 'alice@example.com' });
  });

  it('keeps an edited field pending until the account is read again', async () => {
    let saved = false;
    const refetches = jest.fn();
    server.use(
      http.get('/api/users/alice', async () => {
        if (saved) {
          refetches();
          await delay('infinite');
        }
        return HttpResponse.json(withAccess(AccessControlAction.UsersWrite));
      }),
      // The answer to an email change that needs verification: nothing is stored yet.
      http.put('/api/users/alice', () => {
        saved = true;
        return HttpResponse.json({ message: 'Email sent for verification' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Email' }));
    await user.clear(screen.getByRole('textbox', { name: 'Email' }));
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refetches).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit Email' })).not.toBeInTheDocument();
  });

  it('holds back a second profile save until the first is stored, then sends the stored values', async () => {
    let saved = withAccess(AccessControlAction.UsersWrite);
    const updates = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(saved)),
      http.put<never, Partial<UserDTO>>('/api/users/alice', async ({ request }) => {
        const update = await request.json();
        updates(update);
        await delay(100);
        saved = { ...saved, ...update };
        return HttpResponse.json({ message: 'User updated' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Alice Updated');
    await user.click(screen.getByRole('button', { name: 'Edit Email' }));
    await user.clear(screen.getByRole('textbox', { name: 'Email' }));
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'new@example.com');
    const [saveName, saveEmail] = screen.getAllByRole('button', { name: 'Save' });
    await user.click(saveName);
    expect(saveEmail).toBeDisabled();
    expect(await screen.findByRole('row', { name: 'Name Alice Updated Edit' })).toBeInTheDocument();
    await user.click(saveEmail);
    expect(await screen.findByRole('row', { name: 'Email new@example.com Edit' })).toBeInTheDocument();
    expect(updates.mock.calls).toEqual([
      [{ login: 'alice', name: 'Alice Updated', email: 'alice@example.com' }],
      [{ login: 'alice', name: 'Alice Updated', email: 'new@example.com' }],
    ]);
  });

  it('keeps a failed profile edit open and allows retrying the mutation', async () => {
    let saved = withAccess(AccessControlAction.UsersWrite);
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Alice Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('row', { name: 'Name Alice Updated Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancels a field edit with Escape and does not save an unchanged value', async () => {
    const updates = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersWrite))),
      http.put('/api/users/alice', () => {
        updates();
        return HttpResponse.json({ message: 'User updated' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.keyboard('{Enter}{Escape}');
    expect(screen.getByRole('button', { name: 'Edit Name' })).toBeInTheDocument();
    expect(updates).not.toHaveBeenCalled();
  });

  it('keeps a typed value when another field is opened for editing', async () => {
    server.use(http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersWrite))));
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Name' }));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Alice Draft');
    await user.click(screen.getByRole('button', { name: 'Edit Email' }));
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('alice@example.com');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Alice Draft');
  });

  it.each([{ isExternal: true }, { isProvisioned: true }])(
    'locks externally managed profile fields: %j',
    async (flags) => {
      server.use(
        http.get('/api/users/alice', () =>
          HttpResponse.json({
            ...withAccess(AccessControlAction.UsersWrite, AccessControlAction.UsersPasswordUpdate),
            ...flags,
          })
        )
      );
      setup();
      expect(await screen.findByRole('row', { name: 'Name Alice Example Managed externally' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    }
  );

  it('changes the Grafana admin flag', async () => {
    let saved = withAccess(AccessControlAction.UsersPermissionsUpdate);
    const updates = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(saved)),
      http.put('/api/admin/users/alice/permissions', async ({ request }) => {
        updates(await request.json());
        saved = { ...saved, isGrafanaAdmin: true };
        return HttpResponse.json({ message: 'User permissions updated' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Grafana admin' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('row', { name: 'Grafana admin Yes Edit' })).toBeInTheDocument();
    expect(updates).toHaveBeenCalledWith({ isGrafanaAdmin: true });
  });

  it('cancels the Grafana admin edit with Escape', async () => {
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersPermissionsUpdate)))
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Grafana admin' }));
    expect(screen.getByRole('radio', { name: 'No' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Edit Grafana admin' })).toBeInTheDocument();
  });

  it('sends a new password and closes the editor', async () => {
    const updates = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersPasswordUpdate))),
      http.put('/api/admin/users/alice/password', async ({ request }) => {
        updates(await request.json());
        return HttpResponse.json({ message: 'User password updated' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText('Password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
    expect(updates).toHaveBeenCalledWith({ password: 'new-secret' });
  });
});

describe('account actions', () => {
  it('does not reopen the disable confirmation after enabling the account again', async () => {
    let saved = withAccess(AccessControlAction.UsersDisable, AccessControlAction.UsersEnable);
    const disable = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(saved)),
      http.post('/api/admin/users/alice/disable', () => {
        disable();
        saved = { ...saved, isDisabled: true };
        return HttpResponse.json({ message: 'User disabled' });
      }),
      http.post('/api/admin/users/alice/enable', () => {
        saved = { ...saved, isDisabled: false };
        return HttpResponse.json({ message: 'User enabled' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Disable user' }));
    expect(disable).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable user' }));
    expect(await screen.findByRole('button', { name: 'Enable user' })).toBeInTheDocument();
    expect(disable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('row', { name: 'Status Disabled' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enable user' }));
    expect(await screen.findByRole('button', { name: 'Disable user' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Disable user' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('closes the delete confirmation after a failed deletion and allows retrying', async () => {
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersDelete))),
      http.delete('/api/admin/users/alice', () => HttpResponse.json({ message: 'Cannot delete user' }, { status: 400 }))
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete user' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot delete user');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete user' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('replaces an earlier action error and clears it after a different action succeeds', async () => {
    let saved = {
      ...withAccess(AccessControlAction.UsersDelete, AccessControlAction.UsersDisable, AccessControlAction.UsersEnable),
      isDisabled: true,
    };
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(saved)),
      http.delete('/api/admin/users/alice', () =>
        HttpResponse.json({ message: 'Cannot delete user' }, { status: 400 })
      ),
      http.post('/api/admin/users/alice/enable', () =>
        HttpResponse.json({ message: 'Cannot enable user' }, { status: 400 })
      )
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Enable user' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot enable user');
    await user.click(screen.getByRole('button', { name: 'Delete user' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete user'));
    server.use(
      http.post('/api/admin/users/alice/enable', () => {
        saved = { ...saved, isDisabled: false };
        return HttpResponse.json({ message: 'User enabled' });
      })
    );
    await user.click(screen.getByRole('button', { name: 'Enable user' }));
    expect(await screen.findByRole('button', { name: 'Disable user' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancels account deletion without sending a request and restores focus', async () => {
    const remove = jest.fn();
    server.use(
      http.get('/api/users/alice', () => HttpResponse.json(withAccess(AccessControlAction.UsersDelete))),
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

  it('does not show a deleted user again when navigating back', async () => {
    let deleted = false;
    server.use(
      http.get('/api/users/alice', () =>
        deleted
          ? HttpResponse.json({ message: 'user not found' }, { status: 404 })
          : HttpResponse.json(withAccess(AccessControlAction.UsersDelete))
      ),
      http.get('/api/org/users', () => HttpResponse.json(deleted ? [] : [member])),
      http.delete('/api/admin/users/alice', () => {
        deleted = true;
        return HttpResponse.json({ message: 'User deleted' });
      })
    );
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete user' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(locationService.getLocation().pathname).toBe('/admin/users'));
    // A real navigation back comes later than the tick in which the page was left.
    await act(() => delay(0));
    act(() => locationService.getHistory().goBack());
    expect(await screen.findByRole('alert')).toHaveTextContent('This information is not available');
    expect(screen.queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument();
  });
});

describe('teams', () => {
  it.each(['unknown', 'authentication'])('falls back to details for an unavailable page: %s', async (page) => {
    setup(page);
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'User details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates between tabs and links to the team edit page', async () => {
    const { user } = setup();
    await screen.findByRole('row', { name: 'Name Alice Example' });
    await user.click(screen.getByRole('tab', { name: 'Teams' }));
    expect(await screen.findByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/org/teams/edit/platform');
    expect(screen.getByText('platform@example.com')).toBeInTheDocument();
    expect(locationService.getLocation().pathname).toBe('/admin/users/edit/alice/teams');
    expect(locationService.getLocation().search).toBe('');
    await user.click(screen.getByRole('tab', { name: 'User details' }));
    expect(await screen.findByRole('row', { name: 'Name Alice Example' })).toBeInTheDocument();
    expect(locationService.getLocation().pathname).toBe('/admin/users/edit/alice');
  });

  it('reads teams from the legacy API while the teams API flag is off', async () => {
    const searches = jest.fn();
    server.use(http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', searches));
    setup('teams');
    expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(searches).not.toHaveBeenCalled();
  });

  it('loads teams from the team search in one request when the teams API flag is on', async () => {
    setTestFlags({ kubernetesTeamsApi: true });
    const requests = jest.fn();
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', ({ request }) => {
        requests('search', new URL(request.url).searchParams.get('member'));
        return HttpResponse.json({
          totalHits: 1,
          hits: [{ name: 'platform', title: 'Platform', email: 'platform@example.com', internalId: 21 }],
        });
      }),
      http.get('/api/users/alice/teams', () => {
        requests('legacy');
        return HttpResponse.json([]);
      })
    );
    setup('teams');
    expect(await screen.findByRole('link', { name: 'Platform' })).toHaveAttribute('href', '/org/teams/edit/platform');
    expect(screen.getByText('platform@example.com')).toBeInTheDocument();
    expect(requests.mock.calls).toEqual([['search', 'alice']]);
  });

  it('reads every page of the team search', async () => {
    setTestFlags({ kubernetesTeamsApi: true });
    const pages = jest.fn();
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pages(page);
        const hit =
          page === '2'
            ? { name: 'operations', title: 'Operations', internalId: 22 }
            : { name: 'platform', title: 'Platform', internalId: 21 };
        return HttpResponse.json({ totalHits: 2, hits: [hit] });
      })
    );
    setup('teams');
    expect(await screen.findByRole('link', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(pages.mock.calls).toEqual([['1'], ['2']]);
  });

  it('searches teams by the user UID when the address holds a numerical ID', async () => {
    setTestFlags({ kubernetesTeamsApi: true });
    const members = jest.fn();
    server.use(
      http.get('/api/users/12', () => HttpResponse.json(profile)),
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', ({ request }) => {
        members(new URL(request.url).searchParams.get('member'));
        return HttpResponse.json({ totalHits: 1, hits: [{ name: 'platform', title: 'Platform', internalId: 21 }] });
      })
    );
    setup('teams', '12');
    expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(members.mock.calls).toEqual([['alice']]);
  });

  it('says so when the user belongs to no team', async () => {
    server.use(http.get('/api/users/alice/teams', () => HttpResponse.json([])));
    setup('teams');
    expect(
      await screen.findByText('This user does not belong to any teams in the current organization.')
    ).toBeInTheDocument();
  });

  it('explains that the viewer may not read the teams', async () => {
    server.use(http.get('/api/users/alice/teams', () => new HttpResponse(null, { status: 403 })));
    setup('teams');
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
  });

  it('sorts teams by their displayed name in both directions', async () => {
    server.use(
      http.get('/api/users/alice/teams', () =>
        HttpResponse.json([platform, { id: 22, uid: 'analytics', name: 'Analytics' }])
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
});

describe('roles', () => {
  it('shows basic, direct and inherited assignments in one table without losing duplicate sources', async () => {
    setup('roles');
    await screen.findByRole('link', { name: 'Platform' });
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Dashboard reader')).toHaveLength(2);
    expect(within(table).getByText('Viewer')).toBeInTheDocument();
    const inherited = within(table).getByText('Inherited from team').closest('tr')!;
    expect(within(inherited).getByRole('link', { name: 'Platform' })).toHaveAttribute(
      'href',
      '/org/teams/edit/platform'
    );
    expect(within(table).getByText('Directly assigned')).toBeInTheDocument();
  });

  it('loads inherited roles for all teams in one request and preserves their sources', async () => {
    const search = jest.fn();
    server.use(
      http.get('/api/users/alice/teams', () =>
        HttpResponse.json([platform, { id: 22, uid: 'operations', name: 'Operations' }])
      ),
      http.post('/api/access-control/teams/roles/search', async ({ request }) => {
        search(await request.json());
        return HttpResponse.json({ 21: [role], 22: [role] });
      })
    );
    setup('roles');
    expect(await screen.findByRole('link', { name: 'Operations' })).toHaveAttribute(
      'href',
      '/org/teams/edit/operations'
    );
    expect(screen.getByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getAllByText('Dashboard reader')).toHaveLength(3);
    expect(search.mock.calls).toEqual([[{ teamIds: [21, 22] }]]);
  });

  it('labels roles with their group, as the role picker does', async () => {
    server.use(
      http.get('/api/access-control/users/12/roles', () =>
        HttpResponse.json([
          { uid: 'fixed_1', name: 'fixed:annotations:reader', displayName: 'Reader (all)', group: 'Annotations' },
        ])
      )
    );
    setup('roles');
    expect(await screen.findByText('Annotations:Reader (all)')).toBeInTheDocument();
  });

  it('reads user roles with the picker arguments and leaves hidden roles out of the table', async () => {
    const queries = jest.fn();
    server.use(
      http.get('/api/access-control/users/12/roles', ({ request }) => {
        queries(new URL(request.url).search);
        return HttpResponse.json([{ ...role, uid: 'internal', displayName: 'Internal role', hidden: true }]);
      })
    );
    setup('roles');
    // The team still grants the role; the hidden direct one must not show.
    expect(await screen.findByText('Dashboard reader')).toBeInTheDocument();
    expect(screen.queryByText('Internal role')).not.toBeInTheDocument();
    expect(queries.mock.calls).toEqual([['?includeHidden=true&includeMapped=true&targetOrgId=1']]);
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
    server.use(http.post('/api/access-control/teams/roles/search', () => new HttpResponse(null, { status: 403 })));
    setup('roles');
    expect(await screen.findByText('You do not have permission to view this information')).toBeInTheDocument();
    expect(screen.getByText('Dashboard reader')).toBeInTheDocument();
  });

  it('says the user is not a member of the organization and skips the role requests', async () => {
    const roleRequests = jest.fn();
    server.use(
      http.get('/api/org/users', () => HttpResponse.json([])),
      http.get('/api/access-control/users/12/roles', () => {
        roleRequests();
        return HttpResponse.json([role]);
      })
    );
    setup('roles');
    expect(await screen.findByText('This user is not a member of the current organization.')).toBeInTheDocument();
    expect(roleRequests).not.toHaveBeenCalled();
  });

  it('shows assigned roles, but no basic role, to a viewer who may not read organization members', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action !== AccessControlAction.OrgUsersRead);
    setup('roles');
    expect(await screen.findByText('Directly assigned')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission');
    expect(screen.queryByText('Basic role')).not.toBeInTheDocument();
  });

  it('shows assigned roles next to the error when the membership lookup fails', async () => {
    server.use(http.get('/api/org/users', () => new HttpResponse(null, { status: 500 })));
    setup('roles');
    expect(await screen.findByText('Directly assigned')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
  });

  it('sorts role assignments by the displayed assignment type', async () => {
    const { user } = setup('roles');
    await screen.findByRole('link', { name: 'Platform' });
    await user.click(screen.getByRole('button', { name: 'Sort column Assignment type' }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Basic role');
    await user.click(screen.getByRole('button', { name: 'Sort column Assignment type' }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Inherited from team');
  });

  it('updates the basic role from the Roles tab and refreshes the table', async () => {
    jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
    let basicRole = 'Viewer';
    const updates = jest.fn();
    server.use(
      http.get('/api/org/users', () => HttpResponse.json([{ ...editableMember, role: basicRole }])),
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
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Editor')).toBeInTheDocument());
    expect(updates).toHaveBeenCalledWith({ role: 'Editor' });
  });

  it('restores the saved basic role in the Roles tab after a rejected update', async () => {
    server.use(
      http.get('/api/access-control/roles', () => HttpResponse.json([])),
      http.get('/api/org/users', () => HttpResponse.json([editableMember])),
      http.patch('/api/org/users/12', () => HttpResponse.json({ message: 'Role update rejected' }, { status: 400 }))
    );
    const { user } = setup('roles');
    await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
    await user.click(within(await screen.findByTestId('role-picker')).getByText('Viewer'));
    await user.click(screen.getByText('Editor'));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Role update rejected');
    await waitFor(() => expect(within(screen.getByTestId('role-picker')).getByText('Viewer')).toBeInTheDocument());
  });

  it('reports a rejected custom-role update and restores the picker', async () => {
    server.use(
      http.get('/api/org/users', () => HttpResponse.json([editableMember])),
      http.get('/api/users/alice/teams', () => HttpResponse.json([])),
      http.get('/api/access-control/users/12/roles', () => HttpResponse.json([])),
      http.get('/api/access-control/roles', () =>
        HttpResponse.json([{ ...role, group: 'Dashboards', delegatable: true }])
      ),
      http.put('/api/access-control/users/12/roles', () =>
        HttpResponse.json({ message: 'Roles update rejected' }, { status: 400 })
      )
    );
    const { user } = setup('roles');
    await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
    await user.click(within(await screen.findByTestId('role-picker')).getByText('Viewer'));
    // The roles can be changed once the assigned ones are read.
    const firstRole = () => within(screen.getByLabelText('Role picker menu')).getAllByRole('checkbox')[0];
    await waitFor(() => expect(firstRole()).toBeEnabled());
    await user.click(firstRole());
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Roles update rejected');
    expect(within(screen.getByTestId('role-picker')).queryByText('+1 role')).not.toBeInTheDocument();
  });

  describe('when the assigned roles cannot be read', () => {
    let basicRole: string;
    const writes = jest.fn();

    beforeEach(() => {
      basicRole = 'Viewer';
      writes.mockClear();
      server.use(
        http.get('/api/org/users', () => HttpResponse.json([{ ...editableMember, role: basicRole }])),
        http.get('/api/access-control/users/12/roles', () => new HttpResponse(null, { status: 500 })),
        http.get('/api/access-control/roles', () =>
          HttpResponse.json([{ ...role, group: 'Dashboards', delegatable: true }])
        ),
        http.patch('/api/org/users/12', async ({ request }) => {
          writes('basic role', await request.json());
          basicRole = 'Editor';
          return HttpResponse.json({ message: 'Role updated' });
        }),
        http.put('/api/access-control/users/12/roles', async ({ request }) => {
          writes('direct roles', await request.json());
          return HttpResponse.json({ message: 'Roles updated' });
        })
      );
    });

    it('changes the basic role without replacing the direct roles', async () => {
      const { user } = setup('roles');
      await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
      await user.click(within(await screen.findByTestId('role-picker')).getByText('Viewer'));
      await user.click(screen.getByText('Editor'));
      await user.click(screen.getByRole('button', { name: 'Update' }));
      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Editor')).toBeInTheDocument());
      expect(writes.mock.calls).toEqual([['basic role', { role: 'Editor' }]]);
    });

    it('does not offer direct role changes', async () => {
      const { user } = setup('roles');
      await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
      await user.click(within(await screen.findByTestId('role-picker')).getByText('Viewer'));
      expect(within(screen.getByLabelText('Role picker menu')).getAllByRole('checkbox')[0]).toBeDisabled();
    });
  });

  it('does not offer basic-role editing when the specific org user lacks write permission', async () => {
    jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
    setup('roles');
    expect(await screen.findByText('Viewer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });

  it('does not offer basic-role editing for a provisioned user', async () => {
    jest.spyOn(contextSrv, 'licensedAccessControlEnabled').mockReturnValue(false);
    server.use(http.get('/api/org/users', () => HttpResponse.json([{ ...editableMember, isProvisioned: true }])));
    setup('roles');
    expect(await screen.findByText('Viewer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });

  it('does not offer role editing without write permissions', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => !['users.roles:add', 'users.roles:remove'].includes(action));
    setup('roles');
    expect(await screen.findByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });
});

describe('organizations', () => {
  beforeEach(() => {
    server.use(http.get('/api/access-control/roles', () => HttpResponse.json([])));
  });

  it('restores the saved organization role when a role update fails', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action !== AccessControlAction.ActionUserRolesAdd);
    server.use(
      http.patch('/api/orgs/1/users/alice', () =>
        HttpResponse.json({ message: 'Cannot remove last organization admin' }, { status: 400 })
      )
    );
    const { user } = setup('organizations');
    const picker = await screen.findByTestId('role-picker');
    await user.click(within(picker).getByText('Viewer'));
    await user.click(screen.getByText('Editor'));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot remove last organization admin');
    await waitFor(() => expect(within(screen.getByTestId('role-picker')).getByText('Viewer')).toBeInTheDocument());
    expect(within(screen.getByTestId('role-picker')).queryByText('Editor')).not.toBeInTheDocument();
  });

  it('removes the user from an organization after confirmation', async () => {
    const removals = jest.fn();
    server.use(
      http.delete('/api/orgs/1/users/alice', () => {
        removals();
        return HttpResponse.json({ message: 'User removed from organization' });
      })
    );
    const { user } = setup('organizations');
    await user.click(await screen.findByRole('button', { name: 'Remove from organization' }));
    expect(removals).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(removals).toHaveBeenCalledTimes(1));
  });
});

describe('sessions', () => {
  it('loads sessions only on their tab and revokes one without logout-all permission', async () => {
    const requests = jest.fn();
    const revocations = jest.fn();
    jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => action !== AccessControlAction.UsersLogout);
    server.use(
      http.get('/api/admin/users/alice/auth-tokens', () => {
        requests();
        return HttpResponse.json([sessions[0]]);
      }),
      http.post('/api/admin/users/alice/revoke-auth-token', async ({ request }) => {
        revocations(await request.json());
        return HttpResponse.json({ message: 'User auth token revoked' });
      })
    );
    const { user } = setup();
    await screen.findByRole('row', { name: 'Name Alice Example' });
    expect(requests).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: 'Sessions' }));
    expect(await screen.findByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Force logout from all devices' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Force logout' }));
    await user.click(screen.getByRole('button', { name: 'Confirm logout' }));
    await waitFor(() => expect(revocations).toHaveBeenCalledWith({ authTokenId: 1 }));
  });

  it('lists the most recently seen session first and reverses the order on demand', async () => {
    server.use(http.get('/api/admin/users/alice/auth-tokens', () => HttpResponse.json([sessions[1], sessions[0]])));
    const { user } = setup('sessions');
    await screen.findByText('10.0.0.1');
    const header = screen.getByRole('columnheader', { name: 'Last seen' });
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('10.0.0.1');
    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('10.0.0.2');
  });

  it('keeps session row controls mounted when another action settles', async () => {
    server.use(
      http.get('/api/admin/users/alice/auth-tokens', () => HttpResponse.json(sessions)),
      http.post('/api/admin/users/alice/logout', () =>
        HttpResponse.json({ message: 'Logout rejected' }, { status: 400 })
      )
    );
    const { user } = setup('sessions');
    const rowButton = (await screen.findAllByRole('button', { name: 'Force logout' }))[0];
    await user.click(screen.getByRole('button', { name: 'Force logout from all devices' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Force logout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Logout rejected');
    expect(rowButton).toBeInTheDocument();
  });

  it('closes the logout confirmation when the page moves to another user', async () => {
    server.use(
      http.get('/api/admin/users/:id/auth-tokens', () => HttpResponse.json(sessions)),
      http.get('/api/users/bob', () => HttpResponse.json({ ...profile, id: 13, uid: 'bob', login: 'bob' }))
    );
    const { user } = setup('sessions', 'bob');
    expect(await screen.findByRole('heading', { name: 'bob' })).toBeInTheDocument();
    act(() => locationService.push('/admin/users/edit/alice/sessions'));
    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Force logout from all devices' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => locationService.getHistory().goBack());
    expect(await screen.findByRole('heading', { name: 'bob' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('authentication', () => {
  const licenseInfo = config.licenseInfo;

  beforeEach(() => {
    config.licenseInfo = { ...licenseInfo, enabledFeatures: { ldapsync: true } };
  });

  afterEach(() => {
    config.licenseInfo = licenseInfo;
  });

  it('shows the LDAP sync status and syncs the user on request', async () => {
    const syncs = jest.fn();
    server.use(
      http.get('/api/users/alice', () =>
        HttpResponse.json({ ...profile, isExternal: true, isExternallySynced: true, authLabels: ['LDAP'] })
      ),
      http.get('/api/admin/ldap-sync-status', () => HttpResponse.json({ enabled: false, schedule: '', nextSync: '' })),
      http.post('/api/admin/ldap/sync/12', () => {
        syncs();
        return HttpResponse.json({ message: 'User synced successfully' });
      })
    );
    const { user } = setup('authentication');
    expect(await screen.findByText('Not enabled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sync user' }));
    await waitFor(() => expect(syncs).toHaveBeenCalledTimes(1));
  });
});
