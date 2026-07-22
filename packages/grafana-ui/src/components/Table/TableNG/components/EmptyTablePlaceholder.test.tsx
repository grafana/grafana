import { render, screen } from '@testing-library/react';

import { EmptyTablePlaceholder } from './EmptyTablePlaceholder';

describe('EmptyTablePlaceholder', () => {
  it('renders the default "No rows" message when no value is provided', () => {
    render(<EmptyTablePlaceholder />);
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });

  it('renders the provided noValue string instead of the default', () => {
    render(<EmptyTablePlaceholder noValue="Nothing to see here" />);
    expect(screen.getByText('Nothing to see here')).toBeInTheDocument();
    expect(screen.queryByText('No rows')).not.toBeInTheDocument();
  });

  it('renders an empty placeholder (not the default) when noValue is an empty string', () => {
    // empty string is not nullish, so the `??` fallback to the default label does not apply
    const { container } = render(<EmptyTablePlaceholder noValue="" />);
    expect(screen.queryByText('No rows')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveTextContent('');
  });
});
