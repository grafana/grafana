import { http, HttpResponse } from 'msw';
import { screen, render, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { TeamFolders } from './TeamFolders';

setBackendSrv(backendSrv);
setupMockServer();

describe('TeamFolders', () => {
  it('should render team-owned folders', async () => {
    server.use(
      http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search', ({ request }) => {
        const ownerReference = new URL(request.url).searchParams.get('ownerReference') || null;
        const defaultTeamRef = 'iam.grafana.app/Team/' + MOCK_TEAMS[0].metadata.name;

        return HttpResponse.json({
          hits:
            ownerReference === defaultTeamRef
              ? [{ name: 'team-folder-1', title: 'Team Folder', resource: 'folder', folder: 'general' }]
              : [],
        });
      }),
      http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents', ({ params }) => {
        if (params.name !== 'team-folder-1') {
          return HttpResponse.json({ items: [] });
        }

        return HttpResponse.json({
          items: [
            { name: 'team-folder-1-parent', title: 'Parent Folder' },
            { name: 'team-folder-1', title: 'Team Folder' },
          ],
        });
      })
    );

    render(<TeamFolders teamUid={MOCK_TEAMS[0].metadata.name} />);

    const dashboardsPathLink = await screen.findByRole('link', { name: 'Dashboards' });
    expect(dashboardsPathLink).toHaveAttribute('href', '/dashboards/f/general');

    await waitFor(() => expect(screen.getAllByText('Team Folder', { selector: 'a' })).toHaveLength(2));
    const teamFolderLinks = screen.getAllByText('Team Folder', { selector: 'a' });
    expect(teamFolderLinks).toHaveLength(2);
    expect(teamFolderLinks[0]).toHaveAttribute('href', '/dashboards/f/team-folder-1');
    expect(teamFolderLinks[1]).toHaveAttribute('href', '/dashboards/f/team-folder-1');
  });
});
