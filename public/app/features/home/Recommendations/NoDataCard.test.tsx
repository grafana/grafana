import { render, screen } from 'test/test-utils';

import { type AppPluginConfig } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';

import { ctaClicked } from '../analytics/main';

import { NoDataCard } from './NoDataCard';

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useAppPluginMetas: jest.fn(),
}));

const mockUseAppPluginMetas = jest.mocked(useAppPluginMetas);

function setAvailableApps(pluginIds: string[]) {
  mockUseAppPluginMetas.mockReturnValue({
    loading: false,
    error: undefined,
    value: pluginIds.map((id) => ({ id }) as AppPluginConfig),
  });
}

beforeEach(() => {
  setAvailableApps([]);
});

describe('NoDataCard', () => {
  it('renders the empty-state copy', () => {
    render(<NoDataCard />);

    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No data flowing yet', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/Connect a data source to light up your dashboards and alerts/)).toBeInTheDocument();
    expect(screen.getByText('Popular solutions')).toBeInTheDocument();
  });

  it('links the popular solutions to a prefilled catalog search when the apps are not available', () => {
    setAvailableApps([]);

    render(<NoDataCard />);

    // Catalog search, not per-plugin detail pages: those cannot be assumed to exist on every instance.
    expect(screen.getByRole('link', { name: 'Kubernetes Monitoring' })).toHaveAttribute(
      'href',
      '/plugins?q=kubernetes'
    );
    expect(screen.getByRole('link', { name: 'Synthetic Monitoring' })).toHaveAttribute(
      'href',
      '/plugins?q=synthetic+monitoring'
    );
    expect(screen.getByRole('link', { name: 'k6' })).toHaveAttribute('href', '/plugins?q=k6');
  });

  it('links the popular solutions into the apps that are available', () => {
    setAvailableApps(['grafana-k8s-app', 'grafana-synthetic-monitoring-app', 'grafana-k6-app']);

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

  it('mixes app and catalog links when only some apps are available', () => {
    setAvailableApps(['grafana-k8s-app']);

    render(<NoDataCard />);

    expect(screen.getByRole('link', { name: 'Kubernetes Monitoring' })).toHaveAttribute(
      'href',
      '/a/grafana-k8s-app/home'
    );
    expect(screen.getByRole('link', { name: 'Synthetic Monitoring' })).toHaveAttribute(
      'href',
      '/plugins?q=synthetic+monitoring'
    );
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

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'no_data_card',
        action: 'open_solution',
        placement: 'pill',
        solution: 'kubernetes-monitoring',
      });
    });

    it('tracks synthetic monitoring with the id shared with plugin recommendations', async () => {
      const { user } = render(<NoDataCard />);

      await user.click(screen.getByRole('link', { name: 'Synthetic Monitoring' }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'no_data_card',
        action: 'open_solution',
        placement: 'pill',
        solution: 'synthetic-monitoring',
      });
    });

    it('tracks the connect CTA', async () => {
      const { user } = render(<NoDataCard />);

      await user.click(screen.getByRole('link', { name: 'Connect a data source' }));
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'no_data_card',
        action: 'connect_data_source',
        placement: 'card',
      });
    });
  });
});
