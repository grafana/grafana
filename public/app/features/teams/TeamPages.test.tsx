import { Route, Routes } from 'react-router-dom-v5-compat';
import { screen, render, testWithLicenseFeatures, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';

import TeamPages from './TeamPages';

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/dashboard/v0alpha1'),
  useSearchDashboardsAndFoldersQuery: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();
const useSearchDashboardsAndFoldersQueryMock = useSearchDashboardsAndFoldersQuery as jest.Mock;

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

  beforeEach(() => {
    config.featureToggles.teamFolders = true;
    useSearchDashboardsAndFoldersQueryMock.mockClear();
    useSearchDashboardsAndFoldersQueryMock.mockReturnValue({ data: { hits: [] }, isLoading: false });
  });

  afterEach(() => {
    config.featureToggles.teamFolders = originalTeamFoldersToggle;
  });

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
    useSearchDashboardsAndFoldersQueryMock.mockReturnValue({
      data: {
        hits: [{ name: 'team-folder-1', title: 'Team Folder', resource: 'folder', folder: 'general' }],
      },
      isLoading: false,
    });

    setup({
      pageName: 'folders',
    });

    expect(await screen.findByRole('link', { name: 'Team Folder' })).toHaveAttribute(
      'href',
      '/dashboards/f/team-folder-1'
    );
    expect(screen.getByText(/Parent folder: Dashboards/i)).toBeInTheDocument();
  });
});
