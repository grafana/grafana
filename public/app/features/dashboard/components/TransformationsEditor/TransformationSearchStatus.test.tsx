import { render, screen } from '@testing-library/react';

import { TransformationSearchStatus } from './TransformationSearchStatus';

describe('TransformationSearchStatus', () => {
  it('renders a polite live region', () => {
    render(<TransformationSearchStatus count={5} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('announces the number of results', async () => {
    render(<TransformationSearchStatus count={5} />);

    expect(await screen.findByText('5 transformations found')).toBeInTheDocument();
  });

  it('announces a single result with singular phrasing', async () => {
    render(<TransformationSearchStatus count={1} />);

    expect(await screen.findByText('1 transformation found')).toBeInTheDocument();
  });

  it('announces when no results are found', async () => {
    render(<TransformationSearchStatus count={0} />);

    expect(await screen.findByText('No transformations found')).toBeInTheDocument();
  });

  it('updates the announcement when the count changes', async () => {
    const { rerender } = render(<TransformationSearchStatus count={10} />);

    expect(await screen.findByText('10 transformations found')).toBeInTheDocument();

    rerender(<TransformationSearchStatus count={0} />);

    expect(await screen.findByText('No transformations found')).toBeInTheDocument();
  });
});
