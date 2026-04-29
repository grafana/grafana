import { render, screen } from '@testing-library/react';

import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { ProvisioningOverview } from './ProvisioningOverview';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetResourceStatsQuery: jest.fn(),
}));

// ConnectRepositoryButton requires Router + Redux + frontend settings; stub it
// so this test stays focused on the ProvisioningOverview rendering logic.
jest.mock('../Shared/ConnectRepositoryButton', () => ({
  ConnectRepositoryButton: () => <button>Connect a repository</button>,
}));

// useRepositoryList wraps an RTK Query call; default to "no repos" so the
// banner CTA falls back to the Configure dropdown unless a test overrides.
jest.mock('../hooks/useRepositoryList', () => ({
  useRepositoryList: jest.fn(() => [[], false]),
}));

const mockUseRepositoryList = useRepositoryList as jest.MockedFunction<typeof useRepositoryList>;

const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;

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

  it('renders the empty state when no resources exist', () => {
    mockQuery({ data: { instance: [], unmanaged: [], managed: [] } });
    render(<ProvisioningOverview />);
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  it('shows the provisioned-as-code headline and the Git Sync banner', () => {
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

    // 5 of 20 = 25% of resources are provisioned as code; surfaced as the
    // donut center label.
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
    // The single Git Sync banner replaces the previous green card + unmanaged
    // alert pair: it leads with the coverage count and ends with the CTA.
    expect(screen.getByText(/5 of 20 folders and dashboards are managed by Git Sync/i)).toBeInTheDocument();
    expect(screen.getByText(/git sync is the simplest way/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect a repository/i })).toBeInTheDocument();
  });

  it('shows the Configure dropdown when no Git Sync repository is connected', () => {
    mockUseRepositoryList.mockReturnValue([[], false]);
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByRole('button', { name: /connect a repository/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^export$/i })).not.toBeInTheDocument();
  });

  it('shows the Export button instead of Configure once a repository exists', () => {
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
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    const exportLink = screen.getByRole('link', { name: /^export$/i });
    expect(exportLink).toBeInTheDocument();
    // Single repo → link goes straight to the repository's status page.
    expect(exportLink).toHaveAttribute('href', '/admin/provisioning/my-repo');
    expect(screen.queryByRole('button', { name: /connect a repository/i })).not.toBeInTheDocument();
  });

  it('hides the Git Sync banner when there are no folders or dashboards', () => {
    mockQuery({
      data: {
        instance: [{ group: 'datasource.grafana.app', resource: 'datasources', count: 5 }],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // Without any folders or dashboards the encourage-to-use-Git-Sync banner
    // shouldn't show — there's nothing to connect a repository for yet.
    expect(screen.queryByText(/folders and dashboards are managed by Git Sync/i)).not.toBeInTheDocument();
  });

  it('lists Other providers with their manager identities', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 50 }],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 }],
          },
          {
            kind: 'plugin',
            id: 'cool-plugin',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Other providers')).toBeInTheDocument();
    // Specific manager identities are surfaced.
    expect(screen.getByText('tf-1')).toBeInTheDocument();
    expect(screen.getByText('cool-plugin')).toBeInTheDocument();
  });

  it('buckets managers with no kind under Unknown rather than Git Sync', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
        unmanaged: [],
        managed: [
          {
            id: 'orphan',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 5 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    // Unknown shows up in both the new Summary panel (per-provider stat card)
    // and the Other providers section, so just assert it appears at all.
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
  });

  it('derives the Unmanaged summary from instance - managed so the totals balance', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 30 },
        ],
        // unmanaged comes back empty: backend trusts that managed covers everything.
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 4 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 12 },
            ],
          },
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 6 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    // Total = 40, Git Sync = 16, Other = 6, Unmanaged = 18.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText(/16 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18 of 40/i).length).toBeGreaterThan(0);
    // The donut center reports the combined managed share (22/40 = 55%).
    expect(screen.getAllByText('55%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
  });

  it('renders one Summary stat card per active provider, plus Total and Unmanaged', () => {
    mockQuery({
      data: {
        instance: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 }],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 }],
          },
          {
            kind: 'terraform',
            id: 'tf-1',
            stats: [{ group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    // Summary should show one stat per provider that has resources, alongside
    // Total resources and Unmanaged. With Repo + Terraform + 3 unmanaged, the
    // labels render in the Summary panel.
    expect(screen.getByText('Total resources')).toBeInTheDocument();
    // "Git Sync" appears as a Summary card label and as a chip in the table.
    expect(screen.getAllByText('Git Sync').length).toBeGreaterThan(0);
    // "Terraform" appears as a Summary card label, as a row in the Other
    // providers section, and as a chip in the table.
    expect(screen.getAllByText('Terraform').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unmanaged').length).toBeGreaterThan(0);
  });

  it('lists Files (Classic) as a supporter for folders', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 3 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 2 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // The Folders row should now include Files (Classic) — it
    // creates folders implicitly via the dashboard provider's folder option.
    // Both Folders and Dashboards rows reference the classic chip, so we
    // expect more than one occurrence.
    expect(screen.getAllByText('Files (Classic)').length).toBeGreaterThan(1);
  });

  it('renders the Resource types section with supported-by chips per row', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'datasource.grafana.app', resource: 'datasources', count: 5 },
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 7 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Resource types')).toBeInTheDocument();
    // Both datasources and alert rules should list Terraform and Classic file
    // provisioning as supporting providers via chips in the row.
    expect(screen.getAllByText('Terraform').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Files (Classic)').length).toBeGreaterThan(0);
  });

  it('lists every resource type once in the Resource types section', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 10 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'terraform',
            id: 'tf-a',
            stats: [{ group: 'alerting.grafana.app', resource: 'alertrules', count: 4 }],
          },
          {
            kind: 'terraform',
            id: 'tf-b',
            stats: [{ group: 'alerting.grafana.app', resource: 'alertrules', count: 6 }],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Resource types')).toBeInTheDocument();
    // Each resource type should appear exactly once in the table even when
    // multiple managers of the same kind report it.
    expect(screen.getAllByText('alertrules')).toHaveLength(1);
    // Folders/dashboards are now part of this table too.
    expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
  });
});
