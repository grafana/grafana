import { render, screen } from 'test/test-utils';

import { OverviewStatCards } from './OverviewStatCards';

describe('OverviewStatCards', () => {
  it('shows the dashboards managed-ratio card', () => {
    render(<OverviewStatCards dashboards={{ instanceTotal: 100, managed: 50 }} />);

    // Dashboards card: 50 of 100 managed => 50%.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();
  });

  it('does not render the playlists or all-resources cards when playlists are disabled', () => {
    render(<OverviewStatCards dashboards={{ instanceTotal: 100, managed: 50 }} />);

    expect(screen.queryByText('Playlists')).not.toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
  });

  it('shows the playlists and combined all-resources cards when playlists are enabled', () => {
    render(
      <OverviewStatCards
        dashboards={{ instanceTotal: 100, managed: 50 }}
        playlists={{ instanceTotal: 20, managed: 5 }}
      />
    );

    // Dashboards: 50 of 100 managed.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

    // Playlists: 5 of 20 managed => 25%.
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('5 of 20 managed')).toBeInTheDocument();

    // Combined: 55 of 120 managed.
    expect(screen.getByText('All resources')).toBeInTheDocument();
    expect(screen.getByText('55 of 120 managed')).toBeInTheDocument();
  });

  it('hides a card whose total is zero, and the combined card when only one kind has data', () => {
    // No dashboards exist, but playlists do — only the playlists card renders.
    // The combined "All resources" card would just mirror it, so it stays hidden.
    render(
      <OverviewStatCards dashboards={{ instanceTotal: 0, managed: 0 }} playlists={{ instanceTotal: 20, managed: 5 }} />
    );

    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
  });
});
