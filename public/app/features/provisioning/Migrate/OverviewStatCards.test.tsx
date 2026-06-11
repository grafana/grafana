import { render, screen } from 'test/test-utils';

import { OverviewStatCards } from './OverviewStatCards';

describe('OverviewStatCards', () => {
  it('renders a status card per resource type plus a combined "All resources" card', () => {
    render(<OverviewStatCards totals={{ instanceTotal: 100, managed: 50 }} folderCounts={{ managed: 6, total: 8 }} />);

    // Dashboards card: 50 of 100 managed => 50%.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

    // Folders card: 6 of 8 managed => 75%.
    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('6 of 8 managed')).toBeInTheDocument();

    // All resources card: 56 of 108 managed => 51% (floored from 51.8%).
    expect(screen.getByText('All resources')).toBeInTheDocument();
    expect(screen.getByText('51%')).toBeInTheDocument();
    expect(screen.getByText('56 of 108 managed')).toBeInTheDocument();
  });

  it('omits the folders card when there are no folders', () => {
    render(<OverviewStatCards totals={{ instanceTotal: 10, managed: 0 }} folderCounts={{ managed: 0, total: 0 }} />);

    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
  });
});
