import { render, screen } from 'test/test-utils';

import { OverviewStatCards } from './OverviewStatCards';

describe('OverviewStatCards', () => {
  it('renders one status card per resource type with totals and managed counts', () => {
    render(
      <OverviewStatCards
        totals={{ instanceTotal: 100, managed: 50, unmanaged: 50, gitSync: 40 }}
        folderCounts={{ managed: 6, total: 8 }}
      />
    );

    // Dashboards card: 50 of 100 managed => 50%.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

    // Folders card: 6 of 8 managed => 75%.
    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('6 of 8 managed')).toBeInTheDocument();
  });

  it('omits the folders card when there are no folders', () => {
    render(
      <OverviewStatCards
        totals={{ instanceTotal: 10, managed: 0, unmanaged: 10, gitSync: 0 }}
        folderCounts={{ managed: 0, total: 0 }}
      />
    );

    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
  });
});
