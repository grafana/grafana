import { render, screen } from 'test/test-utils';

import { TokenPermissionsInfo } from './TokenPermissionsInfo';

describe('TokenPermissionsInfo', () => {
  it('lists the Administration: Read-only permission for GitHub', async () => {
    render(<TokenPermissionsInfo type="github" />);

    const row = await screen.findByText(/Administration/);
    expect(row).toHaveTextContent('Administration: Read-only');
  });

  it('does not list the Administration permission for non-GitHub providers', async () => {
    render(<TokenPermissionsInfo type="gitlab" />);

    // Wait for the GitLab list to render before asserting the negative.
    expect(await screen.findByText(/Repository/)).toBeInTheDocument();
    expect(screen.queryByText(/Administration/)).not.toBeInTheDocument();
  });
});
