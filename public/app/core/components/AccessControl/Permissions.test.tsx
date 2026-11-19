import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { Permissions } from './Permissions';

setBackendSrv(backendSrv);
setupMockServer();

describe('Permissions', () => {
  it('shows loading, not an empty editor, until the permissions arrive', async () => {
    let releaseDescription = () => {};
    const descriptionHeld = new Promise<void>((resolve) => {
      releaseDescription = resolve;
    });
    server.use(
      http.get('/api/access-control/folders/description', async () => {
        await descriptionHeld;
        return HttpResponse.json({
          permissions: ['View', 'Edit', 'Admin'],
          assignments: { users: true, serviceAccounts: true, teams: true, builtInRoles: true },
        });
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
});
