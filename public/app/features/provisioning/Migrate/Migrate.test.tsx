import { render, screen } from 'test/test-utils';

import { Migrate } from './Migrate';

describe('Migrate', () => {
  it('renders the Migrate to GitOps heading with an experimental badge', () => {
    render(<Migrate />);

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
  });

  it('links to the provisioning documentation', () => {
    render(<Migrate />);

    const docsLink = screen.getByRole('link', { name: /provisioning documentation/i });
    expect(docsLink).toHaveAttribute('href', expect.stringContaining('grafana.com/docs'));
  });
});
