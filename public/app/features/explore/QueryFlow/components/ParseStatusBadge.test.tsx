import { render, screen } from '@testing-library/react';

import { ParseStatusBadge } from './ParseStatusBadge';

describe('ParseStatusBadge', () => {
  it.each(['valid', 'empty'] as const)('renders nothing for status %s', (status) => {
    const { container } = render(<ParseStatusBadge status={status} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a partial-parse badge', () => {
    render(<ParseStatusBadge status="partial" />);
    expect(screen.getByText('Partially parsed')).toBeInTheDocument();
  });

  it('shows a stale badge for the last-valid-query state', () => {
    render(<ParseStatusBadge status="stale" />);
    expect(screen.getByText('Showing last valid query')).toBeInTheDocument();
  });

  it('shows an unsupported-datasource badge', () => {
    render(<ParseStatusBadge status="unsupported" />);
    expect(screen.getByText('Unsupported data source')).toBeInTheDocument();
  });
});
