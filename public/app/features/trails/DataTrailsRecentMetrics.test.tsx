import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrailsRecentMetrics } from './DataTrailsRecentMetrics';
import { getTrailStore } from './trailStore';

jest.mock('./trailStore', () => ({
  getTrailStore: jest.fn(),
}));

describe('DataTrailsRecentMetrics', () => {
  beforeEach(() => {
    getTrailStore.mockReturnValue({
      recentMetrics: [],
    });
  });

  it('renders the recent metrics header', () => {
    render(<DataTrailsRecentMetrics />);
    expect(screen.getByText('Recent Metrics')).toBeInTheDocument();
  });

  it('does not show the "Show more" button if there are 3 or fewer recent metrics', () => {
    getTrailStore.mockReturnValue({
      recentMetrics: [{}, {}, {}],
    });
    render(<DataTrailsRecentMetrics />);
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });

  it('shows the "Show more" button if there are more than 3 recent metrics', () => {
    getTrailStore.mockReturnValue({
      recentMetrics: [{}, {}, {}, {}],
    });
    render(<DataTrailsRecentMetrics />);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('toggles between "Show more" and "Show less" when the button is clicked', () => {
    getTrailStore.mockReturnValue({
      recentMetrics: [{}, {}, {}, {}],
    });
    render(<DataTrailsRecentMetrics />);
    const button = screen.getByText('Show more');
    fireEvent.click(button);
    expect(screen.getByText('Show less')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('truncates long labels in recent metrics', () => {
    const longLabel = 'This is a very long label that should be truncated';
    getTrailStore.mockReturnValue({
      recentMetrics: [{ label: longLabel }],
    });
    render(<DataTrailsRecentMetrics />);
    expect(screen.getByText(longLabel)).toHaveClass('truncate');
  });

  it('selecting a recent metric card takes you to the metric', () => {
    const onSelectRecentMetric = jest.fn();
    getTrailStore.mockReturnValue({
      recentMetrics: [{ resolve: () => ({ state: { key: '1' }, onSelectRecentMetric }) }],
    });
    render(<DataTrailsRecentMetrics />);
    fireEvent.click(screen.getByText('1'));
    expect(onSelectRecentMetric).toHaveBeenCalled();
  });
});
