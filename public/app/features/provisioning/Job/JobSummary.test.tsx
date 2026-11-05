import { render, screen, within } from 'test/test-utils';

import { type JobResourceSummary } from 'app/api/clients/provisioning/v0alpha1';

import { JobSummary } from './JobSummary';

function setup(summary: JobResourceSummary[]) {
  return render(<JobSummary summary={summary} />);
}

function rowFor(label: string) {
  return screen.findByRole('row', { name: new RegExp(label) });
}

describe('JobSummary', () => {
  it('renders a row per resource kind with its name and an icon', async () => {
    setup([
      { group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2, update: 3, noop: 1 },
      { group: 'folder.grafana.app', kind: 'Folder', delete: 1 },
    ]);

    const dashboardRow = await rowFor('Dashboard');
    expect(within(dashboardRow).getByText('Dashboard')).toBeInTheDocument();
    // The kind icon is rendered alongside the name.
    expect(dashboardRow.querySelector('svg')).toBeInTheDocument();

    expect(await rowFor('Folder')).toBeInTheDocument();
  });

  // Every data source plugin serves its own API group, so the backend emits one row per plugin
  // with the same kind. Without the plugin ID every one of those rows just reads "DataSource".
  it('names the plugin on rows whose kind is served by several groups', async () => {
    setup([
      { group: 'prometheus.datasource.grafana.app', kind: 'DataSource', create: 3 },
      { group: 'loki.datasource.grafana.app', kind: 'DataSource', create: 1 },
      { group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2 },
    ]);

    const prometheusRow = await rowFor('prometheus');
    expect(within(prometheusRow).getByText('DataSource')).toBeInTheDocument();
    expect(within(prometheusRow).getByText('prometheus')).toBeInTheDocument();

    expect(within(await rowFor('loki')).getByText('loki')).toBeInTheDocument();

    // A kind served by a single group gains nothing from a member label.
    const dashboardRow = await rowFor('Dashboard');
    expect(within(dashboardRow).getByText('Dashboard')).toBeInTheDocument();
    expect(within(dashboardRow).queryByText('dashboard.grafana.app')).not.toBeInTheDocument();
  });

  it('computes the total from the action counts', async () => {
    setup([{ group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2, update: 3, noop: 1, error: 1 }]);

    const row = await rowFor('Dashboard');
    const cells = within(row).getAllByRole('cell');
    // Last column is Total: 2 (create) + 3 (update) + 1 (noop) + 1 (error) = 7.
    expect(cells[cells.length - 1]).toHaveTextContent('7');
  });

  it('falls back to an Unknown label and a dash for rows missing a kind or counts', async () => {
    setup([{ group: '', kind: '' }]);

    const row = await rowFor('Unknown');
    expect(within(row).getByText('Unknown')).toBeInTheDocument();
    // The fallback icon still renders.
    expect(row.querySelector('svg')).toBeInTheDocument();
    // Empty count columns render a dash; total of an empty row is 0.
    expect(within(row).getAllByText('-').length).toBeGreaterThan(0);
    const cells = within(row).getAllByRole('cell');
    expect(cells[cells.length - 1]).toHaveTextContent('0');
  });
});
