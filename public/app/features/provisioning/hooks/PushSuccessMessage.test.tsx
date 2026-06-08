import { render, screen } from '@testing-library/react';

import { PushSuccessMessage } from './PushSuccessMessage';

describe('PushSuccessMessage', () => {
  it('should render branch as a link when url is provided', () => {
    render(<PushSuccessMessage branch="main" url="https://github.com/org/repo/tree/main/dashboards" />);

    const link = screen.getByRole('link', { name: 'main' });
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/tree/main/dashboards');
  });

  it('should render branch as plain text when url is not provided', () => {
    render(<PushSuccessMessage branch="main" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Branch text is rendered inline next to the Trans text, so match within the container
    expect(screen.getByText(/main/)).toBeInTheDocument();
  });
});
