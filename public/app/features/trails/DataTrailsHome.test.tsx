import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrailsHome } from './DataTrailsHome';
import { getTrailStore } from './trailStore';

jest.mock('./trailStore', () => ({
  getTrailStore: jest.fn(),
}));

describe('DataTrailsHome', () => {
  beforeEach(() => {
    getTrailStore.mockReturnValue({
      bookmarks: [],
      recent: [],
    });
  });

  it('renders the start button', () => {
    render(<DataTrailsHome />);
    expect(screen.getByText("Let's start!")).toBeInTheDocument();
  });

  it('renders the learn more button and checks its href', () => {
    render(<DataTrailsHome />);
    const learnMoreButton = screen.getByText('Learn more');
    expect(learnMoreButton).toBeInTheDocument();
    expect(learnMoreButton.closest('a')).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana/latest/explore/explore-metrics/'
    );
  });

  it('does not show recent metrics and bookmarks headers for first time user', () => {
    render(<DataTrailsHome />);
    expect(screen.queryByText('Or view a recent exploration')).not.toBeInTheDocument();
    expect(screen.queryByText('Or view bookmarks')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('shows the "Show more" button if there are more than 3 recent metrics', () => {
    getTrailStore.mockReturnValue({
      bookmarks: [],
      recent: [{}, {}, {}, {}],
    });
    render(<DataTrailsHome />);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('toggles between "Show more" and "Show less" when the button is clicked', () => {
    getTrailStore.mockReturnValue({
      bookmarks: [],
      recent: [{}, {}, {}, {}],
    });
    render(<DataTrailsHome />);
    const button = screen.getByText('Show more');
    fireEvent.click(button);
    expect(screen.getByText('Show less')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('truncates long labels in recent explorations', () => {
    const longLabel = 'This is a very long label that should be truncated';
    getTrailStore.mockReturnValue({
      bookmarks: [],
      recent: [{ label: longLabel }],
    });
    render(<DataTrailsHome />);
    expect(screen.getByText(longLabel)).toHaveClass('truncate');
  });

  it('selecting a recent exploration card takes you to the metric', () => {
    const onSelectRecentTrail = jest.fn();
    getTrailStore.mockReturnValue({
      bookmarks: [],
      recent: [{ resolve: () => ({ state: { key: '1' }, onSelectRecentTrail }) }],
    });
    render(<DataTrailsHome />);
    fireEvent.click(screen.getByText('1'));
    expect(onSelectRecentTrail).toHaveBeenCalled();
  });
});
