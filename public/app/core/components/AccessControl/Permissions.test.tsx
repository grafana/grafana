import { delay, http, HttpResponse } from 'msw';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { Permissions } from './Permissions';

setBackendSrv(backendSrv);
setupMockServer();

const description = {
  permissions: ['View', 'Edit', 'Admin'],
  assignments: { users: true, serviceAccounts: true, teams: true, builtInRoles: true },
};

describe('Permissions', () => {
  it('shows loading, not an empty editor, until the permissions arrive', async () => {
    let releaseDescription = () => {};
    const descriptionHeld = new Promise<void>((resolve) => {
      releaseDescription = resolve;
    });
    server.use(
      http.get('/api/access-control/folders/description', async () => {
        await descriptionHeld;
        return HttpResponse.json(description);
      }),
      http.get('/api/access-control/folders/folder-1', () =>
        HttpResponse.json([
          {
            id: 1,
            isManaged: true,
            isInherited: false,
            isServiceAccount: false,
            userId: 1,
            userUid: 'user-1',
            userLogin: 'alice',
            actions: [],
            permission: 'Edit',
          },
        ])
      )
    );

    render(<Permissions resource="folders" resourceId="folder-1" canSetPermissions />);

    expect(screen.getByText('Loading permissions...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a permission' })).not.toBeInTheDocument();

    releaseDescription();

    expect(await screen.findByRole('button', { name: 'Remove permission for alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a permission' })).toBeInTheDocument();
  });

  it('starts the add form over once a permission is added', async () => {
    const rows: Array<Record<string, unknown>> = [];
    server.use(
      http.get('/api/access-control/folders/description', () => HttpResponse.json(description)),
      // As over a network: an answer within the same task would skip the reload in between
      http.get('/api/access-control/folders/folder-1', async () => {
        await delay(20);
        return HttpResponse.json(rows);
      }),
      http.post<{ role: string }, { permission: string }>(
        '/api/access-control/folders/folder-1/builtInRoles/:role',
        async ({ params, request }) => {
          const { permission } = await request.json();
          rows.push({
            id: 2,
            isManaged: true,
            isInherited: false,
            isServiceAccount: false,
            builtInRole: params.role,
            actions: [],
            permission,
          });
          return HttpResponse.json({});
        }
      )
    );
    const { user } = render(<Permissions resource="folders" resourceId="folder-1" canSetPermissions />);

    await user.click(await screen.findByRole('button', { name: 'Add a permission' }));
    await selectOptionInTest(screen.getByRole('combobox', { name: 'Role to add new permission to' }), 'Role');
    await selectOptionInTest(screen.getByRole('combobox', { name: 'Built-in role picker' }), 'Viewer');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Remove permission for Viewer' })).toBeInTheDocument();
    // Still showing the role just added would invite saving it again
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Built-in role picker' })).not.toBeInTheDocument();
  });
});
