import { render, screen } from '@testing-library/react';

import { ManagedReadOnlyBanner } from './ManagedReadOnlyBanner';

describe('ManagedReadOnlyBanner', () => {
  it('renders a resource-agnostic read-only message reusable across kinds', () => {
    render(<ManagedReadOnlyBanner />);

    expect(screen.getByText('This resource is managed externally')).toBeInTheDocument();
    expect(screen.getByText(/managed outside grafana and is read-only/i)).toBeInTheDocument();
    expect(screen.queryByText(/repository|connection/i)).not.toBeInTheDocument();
  });
});
