import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('shows the provisioned-as-code donut and the GitOps explainer', () => {
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

    // The page leads with a "What is GitOps?" alert and the donut shows 25%
    // (5 of 20 managed) in its center label.
    expect(screen.getByText(/migrate to gitops/i)).toBeInTheDocument();
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
  });

  it('routes Migrate to Get started when no Git Sync repository is connected', () => {
    mockUseRepositoryList.mockReturnValue([[], false]);
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

    // Without a repository the button still renders but points at Get
    // started so the user can connect one.
    const migrateLinks = screen.getAllByRole('link', { name: /migrate/i });
    expect(migrateLinks.length).toBeGreaterThan(0);
    migrateLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/admin/provisioning/getting-started');
    });
  });

  it('shows a Migrate link only for Git-Sync-supported rows that still have unmanaged resources', () => {
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
          // alertrules is supported by Terraform/kubectl/etc but not Git Sync,
          // so it should NOT get a Migrate link.
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 2 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // Folders and Dashboards both have unmanaged resources, so each row
    // exposes a Migrate link to the existing Git Sync repository. alertrules
    // shouldn't.
    const migrateLinks = screen.getAllByRole('link', { name: /migrate/i });
    expect(migrateLinks).toHaveLength(2);
    expect(migrateLinks[0]).toHaveAttribute('href', '/admin/provisioning/my-repo');
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

    // Heading appears, all three steps render.
    expect(screen.getByText(/recommended next steps/i)).toBeInTheDocument();
    expect(screen.getByText(/connect a git repository/i)).toBeInTheDocument();
    expect(screen.getByText(/review unmanaged resources/i)).toBeInTheDocument();
    expect(screen.getByText(/migrate your first resource/i)).toBeInTheDocument();
    // The unmanaged-count line includes "5 of 5".
    expect(screen.getByText(/5 of 5 folders and dashboards/i)).toBeInTheDocument();
    // With a repo connected the Migrate step exposes an "Open repository" CTA.
    expect(screen.getByRole('link', { name: /open repository/i })).toBeInTheDocument();
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

    // Total = 40, Managed = 22 (Git Sync 16 + Terraform 6), Unmanaged = 18.
    // Default "All" lens collapses managed providers into a single "Managed"
    // card.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText(/22 of 40/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18 of 40/i).length).toBeGreaterThan(0);
    // 18/40 = 45% appears as the Unmanaged card big number.
    expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
  });

  it('renders Total / Managed / Unmanaged cards under the default "All" lens', () => {
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

    // "All providers" is the default lens — the Summary collapses the managed
    // providers into one card called "Managed" and we always see Total +
    // Unmanaged.
    expect(screen.getByText('Total resources')).toBeInTheDocument();
    expect(screen.getAllByText(/^Managed$/).length).toBeGreaterThan(0);
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

  it('switches the Summary lens when a specific provider is picked', async () => {
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

    // Default "All": single Managed card with the total managed (7 of 10).
    expect(screen.getAllByText(/7 of 10/i).length).toBeGreaterThan(0);

    // Pick the Terraform lens: now we expect a Terraform card (3 of 10) and
    // an "other tools" card (4 of 10) for Git Sync.
    await userEvent.click(screen.getByLabelText(/filter resource types by provider/i));
    await userEvent.click(screen.getByText('Terraform', { selector: '[role="option"] *' }));

    expect(screen.getAllByText(/3 of 10/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4 of 10/i).length).toBeGreaterThan(0);
  });

  it('search filter narrows the donut totals as well as the table', async () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 4 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 16 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // Before filtering: nothing is managed, totals are computed against 20.
    // Word-boundary the regex so "20 of 20" doesn't accidentally match.
    expect(screen.getAllByText(/\b0 of 20\b/i).length).toBeGreaterThan(0);

    // Pick "Folders" from the resource types MultiSelect.
    const typesInput = screen.getByLabelText(/filter by resource type/i);
    await userEvent.click(typesInput);
    await userEvent.click(screen.getByText('Folders', { selector: '[role="option"] *' }));

    // After filtering to folders: 4 unmanaged of 4 total. The Summary cards
    // recompute against the filtered set.
    expect(screen.getAllByText(/\b4 of 4\b/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/\b0 of 20\b/i)).toHaveLength(0);
  });

  it('narrows the table to the resource types picked in the MultiSelect', async () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 1 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 },
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('alertrules')).toBeInTheDocument();

    const typesInput = screen.getByLabelText(/filter by resource type/i);
    await userEvent.click(typesInput);
    await userEvent.click(screen.getByText('alertrules', { selector: '[role="option"] *' }));

    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
    // alertrules appears as the selected chip in the MultiSelect AND as the
    // row in the table — at least one occurrence is enough.
    expect(screen.getAllByText('alertrules').length).toBeGreaterThan(0);
  });

  it('renders the % managed column for each row', () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 4 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
        ],
        unmanaged: [],
        managed: [
          {
            kind: 'repo',
            id: 'r1',
            // 4 / 4 folders managed → 100%; 1 / 4 dashboards managed → 25%.
            stats: [
              { group: 'folder.grafana.app', resource: 'folders', count: 4 },
              { group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 },
            ],
          },
        ],
      },
    });

    render(<ProvisioningOverview />);

    // The % managed column header is present and the per-row percentages
    // render alongside the absolute counts.
    expect(screen.getByText('% managed')).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
  });

  it('limits the table and counts to supported resources when a provider is selected', async () => {
    mockQuery({
      data: {
        instance: [
          { group: 'folder.grafana.app', resource: 'folders', count: 1 },
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 1 },
          { group: 'alerting.grafana.app', resource: 'alertrules', count: 5 },
          { group: 'user-storage.grafana.app', resource: 'user-storage', count: 1 },
        ],
        unmanaged: [],
        managed: [],
      },
    });

    render(<ProvisioningOverview />);

    // Initial "All" lens shows everything.
    expect(screen.getByText('alertrules')).toBeInTheDocument();
    expect(screen.getByText('user-storage')).toBeInTheDocument();

    // Switching to Git Sync narrows to only the resources Git Sync supports.
    await userEvent.click(screen.getByLabelText(/filter resource types by provider/i));
    await userEvent.click(screen.getByText('Git Sync', { selector: '[role="option"] *' }));

    // Folders + Dashboards are the only supported types under Git Sync.
    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    // Unsupported types disappear from the table.
    expect(screen.queryByText('alertrules')).not.toBeInTheDocument();
    expect(screen.queryByText('user-storage')).not.toBeInTheDocument();
    // Total card relabels to "Supported resources" and counts only the
    // supported types: 1 folder + 1 dashboard = 2.
    expect(screen.getByText('Supported resources')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('adds an Others column to the table when a specific provider is selected', async () => {
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

    // No Other tools column under the "All" lens.
    expect(screen.queryByRole('columnheader', { name: /^others$/i })).not.toBeInTheDocument();

    // Switch the lens to Terraform.
    await userEvent.click(screen.getByLabelText(/filter resource types by provider/i));
    await userEvent.click(screen.getByText('Terraform', { selector: '[role="option"] *' }));

    // Now the table picks up the Other tools column too.
    expect(screen.getByRole('columnheader', { name: /^others$/i })).toBeInTheDocument();
  });

  it('renders a per-row coverage bar instead of the old status icon', () => {
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

    // The leading status circle was replaced by a coverage bar — there's the
    // page-level bar plus one per row, so we expect at least two labels.
    expect(screen.getAllByLabelText(/coverage progress/i).length).toBeGreaterThanOrEqual(2);
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
