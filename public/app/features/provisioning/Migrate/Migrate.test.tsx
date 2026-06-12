import { HttpResponse, delay, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';
import { createRepository } from '../mocks/factories';
import { setupProvisioningMswServer } from '../mocks/server';

import { Migrate } from './Migrate';
import { type FolderRow, useFolderMigrationData } from './hooks/useFolderMigrationData';

setupProvisioningMswServer();

// The folder list is fed by the unified searcher (not an HTTP endpoint), so we
// mock the hook here and exercise its own logic in useFolderMigrationData.test.
jest.mock('./hooks/useFolderMigrationData', () => ({
  useFolderMigrationData: jest.fn(),
}));
jest.mock('../hooks/useRepositoryList', () => ({
  useRepositoryList: jest.fn(),
}));

const mockUseFolderMigrationData = jest.mocked(useFolderMigrationData);
const mockUseRepositoryList = jest.mocked(useRepositoryList);

function mockFolders(data: FolderRow[] = []) {
  mockUseFolderMigrationData.mockReturnValue({ data, isLoading: false, isError: false });
}

beforeEach(() => {
  mockFolders();
  // One connected repository by default so the migrate actions are enabled.
  mockUseRepositoryList.mockReturnValue([[createRepository({ metadata: { name: 'repo-1' } })], false]);
});

// 100 dashboards total, 40 managed by Git Sync, 10 by Terraform => 50 managed,
// 50 unmanaged. 8 folders total, 6 managed (4 git sync + 2 terraform).
const stats: ResourceStats = {
  instance: [
    { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
    { group: 'folder.grafana.app', resource: 'folders', count: 8 },
  ],
  managed: [
    {
      kind: 'repo',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
        { group: 'folder.grafana.app', resource: 'folders', count: 4 },
      ],
    },
    {
      kind: 'terraform',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
    },
  ],
};

function respondWithStats(response: ResourceStats) {
  server.use(http.get(`${BASE}/stats`, () => HttpResponse.json(response)));
}

describe('Migrate', () => {
  it('renders a loading spinner while stats are loading', () => {
    server.use(
      http.get(`${BASE}/stats`, async () => {
        await delay('infinite');
        return HttpResponse.json(stats);
      })
    );

    render(<Migrate />);

    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert when the stats query fails', async () => {
    server.use(http.get(`${BASE}/stats`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<Migrate />);

    expect(await screen.findByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders an empty state only when there are no resources at all', async () => {
    respondWithStats({ instance: [], managed: [] });

    render(<Migrate />);

    expect(await screen.findByText(/no provisioned resources yet/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start migration/i })).not.toBeInTheDocument();
  });

  it('renders the folder cards when there are folders but no dashboards', async () => {
    respondWithStats({
      instance: [{ group: 'folder.grafana.app', resource: 'folders', count: 4 }],
      managed: [{ kind: 'repo', stats: [{ group: 'folder.grafana.app', resource: 'folders', count: 1 }] }],
    });

    render(<Migrate />);

    // Not the empty state — folders are still migration targets. Both the
    // Folders and All resources cards read "1 of 4 managed".
    expect(await screen.findByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('All resources')).toBeInTheDocument();
    expect(screen.getAllByText('1 of 4 managed')).toHaveLength(2);
    expect(screen.queryByText(/no provisioned resources yet/i)).not.toBeInTheDocument();
    // No dashboards, so that card is hidden.
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
  });

  describe('with unmanaged resources', () => {
    beforeEach(() => {
      respondWithStats(stats);
    });

    it('renders the header with an experimental badge', async () => {
      render(<Migrate />);

      expect(await screen.findByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
      expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
    });

    it('renders a status card per resource type plus a combined "All resources" card', async () => {
      render(<Migrate />);

      // Dashboards: 50 of 100 managed.
      expect(await screen.findByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

      // Folders: 6 of 8 managed.
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('6 of 8 managed')).toBeInTheDocument();

      // All resources: 56 of 108 managed.
      expect(screen.getByText('All resources')).toBeInTheDocument();
      expect(screen.getByText('56 of 108 managed')).toBeInTheDocument();
    });

    it('opens the migrate drawer from the Start migration button', async () => {
      const { user } = render(<Migrate />);

      const startButton = await screen.findByRole('button', { name: /start migration/i });
      expect(screen.queryByText(/all dashboards and folders will be migrated/i)).not.toBeInTheDocument();

      await user.click(startButton);

      // The real drawer opens with its repository-selection copy.
      expect(await screen.findByText(/all dashboards and folders will be migrated/i)).toBeInTheDocument();
    });

    it('lists unmanaged folders in the Dashboards to migrate table', async () => {
      mockFolders([
        {
          uid: 'team-a',
          title: 'Team A',
          dashboardCount: 2,
          directDashboards: [
            { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
            { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
          ],
          subfolders: [],
          allDashboards: [
            { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
            { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
          ],
        },
      ]);

      render(<Migrate />);

      expect(await screen.findByText('Dashboards to migrate')).toBeInTheDocument();
      expect(screen.getByText('Team A')).toBeInTheDocument();
    });

    it('opens the drawer scoped to the selection when migrating selected folders', async () => {
      mockFolders([
        {
          uid: 'team-a',
          title: 'Team A',
          dashboardCount: 2,
          directDashboards: [
            { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
            { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
          ],
          subfolders: [],
          allDashboards: [
            { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
            { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
          ],
        },
      ]);

      const { user } = render(<Migrate />);

      // Picking the folder cascades to its two dashboards.
      await user.click(await screen.findByRole('checkbox', { name: /select folder team a/i }));
      await user.click(screen.getByRole('button', { name: /migrate selected \(1\)/i }));

      // The drawer opens in selective mode summarizing the two dashboards.
      expect(await screen.findByText(/2 selected dashboards/i)).toBeInTheDocument();
      expect(screen.queryByText(/all dashboards and folders will be migrated/i)).not.toBeInTheDocument();
    });
  });

  it('shows an "all managed" note and no migrate action when nothing is unmanaged', async () => {
    respondWithStats({
      instance: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
      managed: [
        {
          kind: 'repo',
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
            { group: 'folder.grafana.app', resource: 'folders', count: 2 },
          ],
        },
      ],
    });

    render(<Migrate />);

    expect(await screen.findByText(/already managed in git/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start migration/i })).not.toBeInTheDocument();
  });
});
