import { http, HttpResponse } from 'msw';
import { screen, render } from 'test/test-utils';

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
      })
    );

    render(<TeamFolders teamUid={MOCK_TEAMS[0].metadata.name} />);

    const folderLinkLabel = await screen.findByText('/Team Folder');
    expect(folderLinkLabel.closest('a')).toHaveAttribute('href', '/dashboards/f/team-folder-1');
    const parentFolderLink = screen.getByText('/Dashboards');
    expect(parentFolderLink.closest('a')).toHaveAttribute('href', '/dashboards/f/general');
  });
});
