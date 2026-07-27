import { render, screen } from 'test/test-utils';

import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';

describe('MigrateToGitopsHeader', () => {
  it('renders the title, experimental badge and subtitle', () => {
    render(<MigrateToGitopsHeader />);

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
    expect(screen.getByText(/manage your grafana resources like code/i)).toBeInTheDocument();
  });
});
