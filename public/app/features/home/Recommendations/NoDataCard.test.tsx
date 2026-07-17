import { render, screen } from 'test/test-utils';

import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';

import { noDataCtaClicked } from '../analytics/main';

import { NoDataCard } from './NoDataCard';

jest.mock('../analytics/main', () => ({
  noDataCtaClicked: jest.fn(),
}));

describe('NoDataCard', () => {
  it('renders the empty-state copy', () => {
    render(<NoDataCard />);

    expect(screen.getByText('No solution enabled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No data flowing yet', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Connect a data source to light up your dashboards and alerts/)).toBeInTheDocument();
    expect(screen.getByText('Popular solutions')).toBeInTheDocument();
  });

  it('links the popular solutions to their solution pages', () => {
    render(<NoDataCard />);

    expect(screen.getByRole('link', { name: 'Kubernetes Monitoring' })).toHaveAttribute(
      'href',
      '/a/grafana-k8s-app/home'
    );
    expect(screen.getByRole('link', { name: 'Synthetic Monitoring' })).toHaveAttribute(
      'href',
      '/a/grafana-synthetic-monitoring-app/home'
    );
    expect(screen.getByRole('link', { name: 'k6' })).toHaveAttribute('href', '/a/grafana-k6-app');
  });

  it('links the connect CTA to add-new-connection', () => {
    render(<NoDataCard />);

    expect(screen.getByRole('link', { name: 'Connect a data source' })).toHaveAttribute(
      'href',
      '/connections/add-new-connection'
    );
  });

  describe('analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks popular-solution clicks with the solution id', async () => {
      const { user } = render(<NoDataCard />);

      await user.click(screen.getByRole('link', { name: 'Kubernetes Monitoring' }));

      expect(jest.mocked(noDataCtaClicked)).toHaveBeenCalledWith({
        cta: 'solution',
        solution_id: 'kubernetes-monitoring',
      });
    });

    it('tracks the connect CTA', async () => {
      const { user } = render(<NoDataCard />);

      await user.click(screen.getByRole('link', { name: 'Connect a data source' }));
      expect(jest.mocked(noDataCtaClicked)).toHaveBeenCalledWith({ cta: 'connect_data_source' });
    });
  });
});
