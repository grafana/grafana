import { render, screen } from 'test/test-utils';

import { createJob } from '../mocks/factories';

import { JobContent } from './JobContent';

const url = {
  newPullRequestURL: 'https://github.com/org/repo/compare/main...feature?quick_pull=1',
  branchURL: 'https://github.com/org/repo/tree/feature',
  compareURL: 'https://github.com/org/repo/compare/main...feature',
};

describe('JobContent', () => {
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
