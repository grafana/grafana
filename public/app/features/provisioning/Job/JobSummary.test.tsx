import { render, screen, within } from 'test/test-utils';

import { type JobResourceSummary } from 'app/api/clients/provisioning/v0alpha1';

import { JobSummary } from './JobSummary';

function setup(summary: JobResourceSummary[]) {
  return render(<JobSummary summary={summary} />);
}

function rowFor(label: string) {
  return screen.getByRole('row', { name: new RegExp(label) });
}

describe('JobSummary', () => {
  it('renders a row per resource kind with its name and an icon', () => {
    setup([
      { group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2, update: 3, noop: 1 },
      { group: 'folder.grafana.app', kind: 'Folder', delete: 1 },
    ]);

    const dashboardRow = rowFor('Dashboard');
    expect(within(dashboardRow).getByText('Dashboard')).toBeInTheDocument();
    // The kind icon is rendered alongside the name.
    expect(dashboardRow.querySelector('svg')).toBeInTheDocument();

    expect(rowFor('Folder')).toBeInTheDocument();
  });

  it('computes the total from the action counts', () => {
    setup([{ group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2, update: 3, noop: 1, error: 1 }]);

    const row = rowFor('Dashboard');
    const cells = within(row).getAllByRole('cell');
    // Last column is Total: 2 (create) + 3 (update) + 1 (noop) + 1 (error) = 7.
    expect(cells[cells.length - 1]).toHaveTextContent('7');
  });

  it('shows resourceErrors/resourceWarnings messages in a modal when the count is clicked', async () => {
    const { user } = setup([
      {
        group: 'dashboard.grafana.app',
        kind: 'Dashboard',
        error: 1,
        warning: 1,
        resourceErrors: [
          { message: 'strict decoding error', path: 'dashboards/broken.json', reason: 'ResourceInvalid' },
        ],
        resourceWarnings: [{ message: 'missing folder metadata', path: 'dashboards/' }],
      },
    ]);

    const row = rowFor('Dashboard');
    const cells = within(row).getAllByRole('cell');
    // Column order: resource, created, deleted, updated, unchanged, warnings, errors, total.
    await user.click(within(cells[5]).getByText('1'));
    expect(await screen.findByRole('dialog', { name: /dashboard warnings/i })).toBeInTheDocument();
    expect(screen.getByText('dashboards/: missing folder metadata')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(cells[6]).getByText('1'));
    expect(await screen.findByRole('dialog', { name: /dashboard errors/i })).toBeInTheDocument();
    expect(screen.getByText('dashboards/broken.json: strict decoding error')).toBeInTheDocument();
  });

  it('falls back to the deprecated errors/warnings string arrays when resourceErrors/resourceWarnings are absent', async () => {
    const { user } = setup([
      {
        group: 'dashboard.grafana.app',
        kind: 'Dashboard',
        error: 1,
        errors: ['legacy error message'],
      },
    ]);

    const row = rowFor('Dashboard');
    const cells = within(row).getAllByRole('cell');
    await user.click(within(cells[6]).getByText('1'));
    expect(await screen.findByText('legacy error message')).toBeInTheDocument();
  });

  it('falls back to an Unknown label and a dash for rows missing a kind or counts', () => {
    setup([{ group: '', kind: '' }]);

    const row = rowFor('Unknown');
    expect(within(row).getByText('Unknown')).toBeInTheDocument();
    // The fallback icon still renders.
    expect(row.querySelector('svg')).toBeInTheDocument();
    // Empty count columns render a dash; total of an empty row is 0.
    expect(within(row).getAllByText('-').length).toBeGreaterThan(0);
    const cells = within(row).getAllByRole('cell');
    expect(cells[cells.length - 1]).toHaveTextContent('0');
  });
});
