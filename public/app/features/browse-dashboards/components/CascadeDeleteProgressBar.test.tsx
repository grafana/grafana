import { render, screen } from 'test/test-utils';

import { CascadeDeleteProgressBar } from './CascadeDeleteProgressBar';

describe('CascadeDeleteProgressBar', () => {
  it('renders a determinate progressbar reflecting the given percent', () => {
    render(<CascadeDeleteProgressBar percent={42} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('renders without a progressbar role when percent is unknown (indeterminate)', () => {
    render(<CascadeDeleteProgressBar />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
