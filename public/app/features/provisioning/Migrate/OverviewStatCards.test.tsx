import { render, screen } from 'test/test-utils';

import { OverviewStatCards } from './OverviewStatCards';

describe('OverviewStatCards', () => {
  it('shows the dashboards managed-ratio card', () => {
    render(<OverviewStatCards totals={{ instanceTotal: 100, managed: 50 }} />);

    // Dashboards card: 50 of 100 managed => 50%.
    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();
  });

  it('does not render the folder, all-resources or folders-to-migrate cards', () => {
    render(<OverviewStatCards totals={{ instanceTotal: 100, managed: 50 }} />);

    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Folders to migrate')).not.toBeInTheDocument();
  });
});
