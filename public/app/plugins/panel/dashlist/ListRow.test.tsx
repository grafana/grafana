import { render, screen } from 'test/test-utils';

import { ListRow } from './ListRow';

describe('ListRow', () => {
  it('renders the title and subtitle', () => {
    render(<ListRow title="My title" subtitle="My subtitle" />);

    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.getByText('My subtitle')).toBeInTheDocument();
  });

  it('does not render a subtitle when it is omitted', () => {
    render(<ListRow title="My title" />);

    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.queryByText('My subtitle')).not.toBeInTheDocument();
  });

  it('renders prefix and trailing content', () => {
    render(<ListRow title="My title" prefix={<span>prefix-content</span>} trailing={<span>trailing-content</span>} />);

    expect(screen.getByText('prefix-content')).toBeInTheDocument();
    expect(screen.getByText('trailing-content')).toBeInTheDocument();
  });

  describe('when an href is provided', () => {
    it('links to the href and exposes the title and subtitle as its accessible name', () => {
      render(<ListRow title="My title" subtitle="My subtitle" href="/some/path" />);

      expect(screen.getByRole('link', { name: 'My title My subtitle' })).toHaveAttribute('href', '/some/path');
    });

    it('calls onClick when the link is clicked', async () => {
      const onClick = jest.fn();
      const { user } = render(<ListRow title="My title" href="/some/path" onClick={onClick} />);

      await user.click(screen.getByRole('link', { name: 'My title' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('when no href is provided', () => {
    it('renders the title as plain text without a link', () => {
      render(<ListRow title="My title" />);

      expect(screen.getByText('My title')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
