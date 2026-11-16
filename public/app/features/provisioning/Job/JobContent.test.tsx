import { render, screen, within } from 'test/test-utils';

import { createJob } from '../mocks/factories';

import { JobContent } from './JobContent';

const url = {
  newPullRequestURL: 'https://github.com/org/repo/compare/main...feature?quick_pull=1',
  branchURL: 'https://github.com/org/repo/tree/feature',
  compareURL: 'https://github.com/org/repo/compare/main...feature',
};

const summary = [{ group: 'dashboard.grafana.app', kind: 'Dashboard', create: 2 }];

describe('JobContent', () => {
  it('shows the live summary while keeping job JSON collapsed until requested', async () => {
    const job = createJob({ status: { summary } });

    const { user } = render(<JobContent job={job} jobType="sync" showLiveSummary />);

    const row = await screen.findByRole('row', { name: /Dashboard/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Dashboard', '2', '-', '-', '-', '-', '-', '2']);
    expect(screen.getByRole('progressbar', { name: 'Progress Bar' })).toHaveAttribute('aria-valuenow', '30');
    const detailsButton = screen.getByRole('button', { name: 'View details' });
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/"name": "job-1"/)).not.toBeInTheDocument();

    await user.click(detailsButton);

    expect(screen.getByText(/"name": "job-1"/).textContent).toBe(JSON.stringify(job, null, 2));
    expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it.each(['success', 'warning', 'error'] as const)('keeps the live summary when the job reaches %s', async (state) => {
    const { rerender } = render(<JobContent job={createJob({ status: { summary } })} jobType="sync" showLiveSummary />);

    expect(await screen.findByRole('row', { name: /Dashboard/ })).toHaveTextContent('2');

    rerender(<JobContent job={createJob({ status: { state, summary, url } })} jobType="sync" showLiveSummary />);

    const row = await screen.findByRole('row', { name: /Dashboard/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Dashboard', '2', '-', '-', '-', '-', '-', '2']);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    if (state === 'success') {
      expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'View details' })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it.each([
    { name: 'missing', summary: undefined },
    { name: 'empty', summary: [] },
  ])('keeps showing progress without a table when the live summary is $name', ({ summary }) => {
    render(<JobContent job={createJob({ status: { summary } })} jobType="sync" showLiveSummary />);

    expect(screen.getByRole('progressbar', { name: 'Progress Bar' })).toHaveAttribute('aria-valuenow', '30');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });

  it('keeps live summaries hidden by default for other job views', () => {
    render(<JobContent job={createJob({ status: { summary } })} jobType="sync" />);

    expect(screen.getByRole('progressbar', { name: 'Progress Bar' })).toHaveAttribute('aria-valuenow', '30');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows finished job summaries without opting in to live summaries', async () => {
    render(<JobContent job={createJob({ status: { state: 'warning', summary, url } })} jobType="sync" isFinishedJob />);

    const row = await screen.findByRole('row', { name: /Dashboard/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Dashboard', '2', '-', '-', '-', '-', '-', '2']);
  });

  it('links to the pull request when the job finished with warnings', () => {
    const job = createJob({ status: { state: 'warning', message: 'Resource not found', url } });

    render(<JobContent job={job} jobType="delete" isFinishedJob />);

    expect(screen.getByRole('link', { name: /open pull request/i })).toHaveAttribute('href', url.newPullRequestURL);
    expect(screen.getByText('View details')).toBeInTheDocument();
  });

  it('shows no branch links for a failed job', () => {
    const job = createJob({ status: { state: 'error', message: 'file not found', url } });

    render(<JobContent job={job} jobType="delete" isFinishedJob />);

    expect(screen.queryByRole('link', { name: /open pull request/i })).not.toBeInTheDocument();
    expect(screen.getByText('View details')).toBeInTheDocument();
  });
});
