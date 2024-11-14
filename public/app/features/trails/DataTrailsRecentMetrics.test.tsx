import { render, screen, fireEvent } from '@testing-library/react';

import { SceneObjectRef } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailsRecentMetrics } from './DataTrailsRecentMetrics';
import { getTrailStore } from './TrailStore/TrailStore';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
}));

const onSelect = jest.fn();

describe('DataTrailsRecentMetrics', () => {
  beforeEach(() => {
    onSelect.mockClear();
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
    }));
  });

  it('renders the recent metrics header if there is at least one recent metric', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [
        {
          resolve: () => ({ state: { key: '1' } }),
        },
      ],
    }));
    render(<DataTrailsRecentMetrics onSelect={onSelect} />);
    expect(screen.getByText('Or view a recent exploration')).toBeInTheDocument();
  });

  it('does not show the "Show more" button if there are 3 or fewer recent metrics', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [
        {
          resolve: () => ({ state: { key: '1' } }),
        },
        {
          resolve: () => ({ state: { key: '2' } }),
        },
        {
          resolve: () => ({ state: { key: '3' } }),
        },
      ],
    }));
    render(<DataTrailsRecentMetrics onSelect={onSelect} />);
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });

  it('shows the "Show more" button if there are more than 3 recent metrics', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [
        {
          resolve: () => ({ state: { key: '1' } }),
        },
        {
          resolve: () => ({ state: { key: '2' } }),
        },
        {
          resolve: () => ({ state: { key: '3' } }),
        },
        {
          resolve: () => ({ state: { key: '4' } }),
        },
      ],
    }));
    render(<DataTrailsRecentMetrics onSelect={onSelect} />);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('toggles between "Show more" and "Show less" when the button is clicked', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [
        {
          resolve: () => ({ state: { key: '1' } }),
        },
        {
          resolve: () => ({ state: { key: '2' } }),
        },
        {
          resolve: () => ({ state: { key: '3' } }),
        },
        {
          resolve: () => ({ state: { key: '4' } }),
        },
      ],
    }));
    render(<DataTrailsRecentMetrics onSelect={onSelect} />);
    const button = screen.getByText('Show more');
    fireEvent.click(button);
    expect(screen.getByText('Show less')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('selecting a recent exploration card takes you to the metric', () => {
    const trail = new DataTrail({ key: '1', metric: 'select me' });
    const trailWithResolveMethod = new SceneObjectRef(trail);
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [trailWithResolveMethod],
    }));
    render(<DataTrailsRecentMetrics onSelect={onSelect} />);
    fireEvent.click(screen.getByText('select me'));
    expect(onSelect).toHaveBeenCalledWith(trail);
  });
});
