import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { screen, render, testWithLicenseFeatures, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';

import TeamPages from './TeamPages';

setBackendSrv(backendSrv);
setupMockServer();

const setup = (propOverrides: { teamUid?: string; pageName?: string } = {}) => {
  const pageName = propOverrides.pageName ?? 'members';
  const teamUid = propOverrides.teamUid ?? MOCK_TEAMS[0].metadata.name;
  render(
    <Routes>
      <Route path="/org/teams/:uid/:page" element={<TeamPages />} />
    </Routes>,
    { historyOptions: { initialEntries: [`/org/teams/${teamUid}/${pageName}`] } }
  );
};

describe('TeamPages', () => {
  const originalTeamFoldersToggle = config.featureToggles.teamFolders;

  it('should render settings and preferences page', async () => {
    setup({
      pageName: 'settings',
    });

    expect(await screen.findByText('Team details')).toBeInTheDocument();
  });

  describe('teamsync feature disabled', () => {
    testWithLicenseFeatures({ disable: ['teamsync'] });

    it('should not render group sync page', async () => {
      setup({
        pageName: 'groupsync',
      });
      await waitFor(() => expect(screen.queryAllByText(/loading .../i)).toHaveLength(0));

      expect(screen.queryByRole('heading', { name: /external group sync/i })).not.toBeInTheDocument();
    });
  });

  describe('teamsync feature enabled', () => {
    testWithLicenseFeatures({ enable: ['teamsync'] });

    it('should render group sync page', async () => {
      setup({
        pageName: 'groupsync',
      });
      expect(await screen.findByRole('heading', { name: /external group sync/i })).toBeInTheDocument();
    });
  });

  it('should render team-owned folders page', async () => {
    config.featureToggles.teamFolders = true;
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

    setup({
      pageName: 'folders',
    });

    const folderLinkLabel = await screen.findByText('/Team Folder');
    expect(folderLinkLabel.closest('a')).toHaveAttribute('href', '/dashboards/f/team-folder-1');
    const parentFolderLink = screen.getByText('/Dashboards');
    expect(parentFolderLink.closest('a')).toHaveAttribute('href', '/dashboards/f/general');
    config.featureToggles.teamFolders = originalTeamFoldersToggle;
  });
});
