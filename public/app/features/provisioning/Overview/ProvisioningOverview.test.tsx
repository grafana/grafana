import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { ProvisioningOverview } from './ProvisioningOverview';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
}));

// useRepositoryList wraps an RTK Query call. Default to "no repos"; specific
// tests override with a list when needed.
jest.mock('../hooks/useRepositoryList', () => ({
  useRepositoryList: jest.fn(() => [[], false]),
}));

const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;
const mockUseRepositoryList = useRepositoryList as jest.MockedFunction<typeof useRepositoryList>;

function mockQuery(value: Partial<ReturnType<typeof useGetResourceStatsQuery>>) {
  mockUseGetResourceStatsQuery.mockReturnValue({
    refetch: jest.fn(),
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    isUninitialized: false,
    status: 'fulfilled',
    ...value,
  } as ReturnType<typeof useGetResourceStatsQuery>);
}

describe('ProvisioningOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRepositoryList.mockReturnValue([[], false]);
  });

  it('renders a loading indicator while fetching', () => {
    mockQuery({ isLoading: true, isSuccess: false, status: 'pending' });
    render(<ProvisioningOverview />);
    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert on failure', () => {
    mockQuery({ isError: true, isSuccess: false, status: 'rejected', error: { status: 500 } });
    render(<ProvisioningOverview />);
    expect(screen.getByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders the empty state with the Migrate to GitOps header when there are no resources', () => {
    mockQuery({ data: { instance: [], unmanaged: [], managed: [] } });
    render(<ProvisioningOverview />);
    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  it('shows the primary header CTA: Connect a repository when no repo, Start migration when one is connected', () => {
    mockUseRepositoryList.mockReturnValueOnce([[], false]);
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    const { rerender } = render(<ProvisioningOverview />);
    expect(screen.getByRole('link', { name: /connect a repository/i })).toBeInTheDocument();

    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    rerender(<ProvisioningOverview />);
    expect(screen.getByRole('link', { name: /start migration/i })).toBeInTheDocument();
  });

  it('renders a Last scan stat card', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
      // RTK Query exposes `fulfilledTimeStamp` on resolved queries.
      fulfilledTimeStamp: Date.now(),
    } as Partial<ReturnType<typeof useGetResourceStatsQuery>>);
    render(<ProvisioningOverview />);
    expect(screen.getByText(/last scan/i)).toBeInTheDocument();
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('shows the Migrate to GitOps header with a Migration guide link', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });
    render(<ProvisioningOverview />);
    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /migration guide/i })).toBeInTheDocument();
  });

  it('renders the four overview stat cards including Progress to GitOps', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 4 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 16 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 1 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
            ],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Total resources')).toBeInTheDocument();
    // "Managed" / "Unmanaged" appear both as Summary card labels and as
    // table column headers, so just assert presence at all.
    expect(screen.getAllByText('Managed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unmanaged').length).toBeGreaterThan(0);
    expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
    // 5 of 20 = 25% managed and Progress to GitOps (Git Sync managed only)
    // also 5/20 since only Git Sync managed exists in this fixture.
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
  });

  it('lists only Folders and Dashboards in the table even when the API returns other resource types', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 2 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 },
          // Other resource types should be ignored entirely on this page.
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 5 },
          { group: 'user-storage.grafana.app', resource: 'user-storage', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.queryByText('alertrules')).not.toBeInTheDocument();
    expect(screen.queryByText('user-storage')).not.toBeInTheDocument();
    // Total card reflects the folders+dashboards count only.
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders the Recommended next steps panel with dynamic state', () => {
    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 2 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText(/recommended next steps/i)).toBeInTheDocument();
    expect(screen.getByText(/connect a git repository/i)).toBeInTheDocument();
    expect(screen.getByText(/review unmanaged resources/i)).toBeInTheDocument();
    expect(screen.getByText(/migrate your first resource/i)).toBeInTheDocument();
    expect(screen.getByText(/5 of 5 folders and dashboards/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open repository/i })).toBeInTheDocument();
  });

  it('renders the Tooling support panel with Git Sync flagged Recommended', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText(/tooling support/i)).toBeInTheDocument();
    // The "Recommended" word appears both in the panel heading
    // ("Recommended next steps") and as the Git-Sync badge — assert at
    // least two occurrences.
    expect(screen.getAllByText(/recommended/i).length).toBeGreaterThanOrEqual(2);
    // All five tool kinds appear at least once (Git Sync, Files (Classic),
    // Terraform, kubectl, Plugin).
    expect(screen.getAllByText(/git sync/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/files \(classic\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/terraform/i).length).toBeGreaterThan(0);
    // Terraform managed count surfaces.
    expect(screen.getByText(/2 managed/i)).toBeInTheDocument();
  });

  it('exposes a Migrate selected button once rows are checked', async () => {
    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 3 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // No bulk-action bar before any row is checked.
    expect(screen.queryByRole('link', { name: /migrate selected/i })).not.toBeInTheDocument();

    // Pick the Folders row's checkbox.
    const foldersCell = screen.getByText('Folders').closest('[role="row"]');
    expect(foldersCell).not.toBeNull();
    await userEvent.click(within(foldersCell as HTMLElement).getByRole('checkbox'));

    // Bulk Migrate selected link appears, pointing at the existing repo.
    const bulkLink = screen.getByRole('link', { name: /migrate selected/i });
    expect(bulkLink).toHaveAttribute('href', '/admin/provisioning/my-repo');
  });

  it('renders the Migration progress and Managed by tool donut panels', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 4 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 16 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
          },
        ],
      },
    });
    render(<ProvisioningOverview />);
    expect(screen.getByText(/migration progress/i)).toBeInTheDocument();
    expect(screen.getByText(/managed resources by tool/i)).toBeInTheDocument();
    // The donuts include a "managed" sublabel.
    expect(screen.getAllByText(/^managed$/i).length).toBeGreaterThan(0);
  });

  it('renders a per-row coverage bar inside the % managed cell', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    // One bar per row in the table — the page-level bar moved into the
    // Migration progress donut.
    expect(screen.getAllByLabelText(/coverage progress/i).length).toBeGreaterThanOrEqual(1);
  });

  it('points the row-level Migrate link at the existing repository', () => {
    mockUseRepositoryList.mockReturnValue([
      [
        {
          metadata: { name: 'my-repo' },
          spec: { type: 'github', sync: { target: 'folder' } },
        },
      ] as ReturnType<typeof useRepositoryList>[0],
      false,
    ]);
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 1 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    const links = screen.getAllByRole('link', { name: /^migrate$/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute('href', '/admin/provisioning/my-repo');
  });

  it('routes Migrate to Get started when no repository is connected', () => {
    mockUseRepositoryList.mockReturnValue([[], false]);
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 1 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    const migrateLinks = screen.getAllByRole('link', { name: /^migrate$/i });
    migrateLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/admin/provisioning/getting-started');
    });
  });
});
