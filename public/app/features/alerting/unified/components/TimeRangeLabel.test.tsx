import { render, screen } from 'test/test-utils';

import { TimeRangeLabel } from './TimeRangeLabel';

describe('TimeRangeLabel', () => {
  it('renders "to now" when to is 0', () => {
    render(<TimeRangeLabel relativeTimeRange={{ from: 900, to: 0 }} />);

    // 900 seconds -> 15m
    expect(screen.getByText(/to now/i)).toBeInTheDocument();
    expect(screen.getByText('15m')).toBeInTheDocument();
  });

  it('renders "to <to>" when to > 0', () => {
    render(<TimeRangeLabel relativeTimeRange={{ from: 900, to: 60 }} />);

    // 900 seconds -> 15m, 60 seconds -> 1m
    const container = screen.getByText(/to/i).closest('span') || screen.getByText(/to/i).parentElement || document.body;
    expect(container).toHaveTextContent(/15m to 1m/);
  });
});
