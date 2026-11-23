import { render, screen } from '@testing-library/react';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the message as a span by default', () => {
    render(<EmptyState message="No results found" variant="not-found" />);

    expect(screen.getByText('No results found').tagName).toBe('SPAN');
    expect(screen.queryByRole('heading', { name: 'No results found' })).not.toBeInTheDocument();
  });

  it('renders custom message content as provided', () => {
    render(<EmptyState message={<h2>No results found</h2>} variant="not-found" />);

    const heading = screen.getByRole('heading', { level: 2, name: 'No results found' });
    expect(heading).toBeInTheDocument();
  });
});
