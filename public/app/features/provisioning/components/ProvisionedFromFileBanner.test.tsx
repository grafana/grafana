import { render, screen } from 'test/test-utils';

import { ProvisionedFromFileBanner } from './ProvisionedFromFileBanner';

describe('ProvisionedFromFileBanner', () => {
  it('renders a resource-agnostic read-only message reusable across kinds', () => {
    render(<ProvisionedFromFileBanner />);

    expect(screen.getByText('This resource is provisioned from a file')).toBeInTheDocument();
    expect(screen.getByText(/managed from a mounted manifest and is read-only/i)).toBeInTheDocument();
    // The copy must stay generic (no per-kind wording) so both forms can share it.
    expect(screen.queryByText(/repository|connection/i)).not.toBeInTheDocument();
  });
});
