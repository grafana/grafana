import { type ReactNode } from 'react';
import { render, screen } from 'test/test-utils';

import { DMAStatus, useDMAStatus } from '../hooks/useDMAStatus';

import { DMARouteGuard } from './DMARouteGuard';

jest.mock('../hooks/useDMAStatus', () => ({
  ...jest.requireActual('../hooks/useDMAStatus'),
  useDMAStatus: jest.fn(),
}));

jest.mock('./AlertingPageWrapper', () => ({
  AlertingPageWrapper: ({ children, isLoading }: { children?: ReactNode; isLoading?: boolean }) =>
    isLoading ? <div>Loading DMA status</div> : children,
}));

const useDMAStatusMock = jest.mocked(useDMAStatus);

// Spread rather than a default parameter, so an explicit `pluginDestination: undefined` overrides.
function renderGuard(overrides: { pluginDestination?: ReactNode } = {}) {
  const props = { pluginDestination: <div>Plugin page</div>, ...overrides };

  return render(
    <DMARouteGuard {...props} unavailableDescription="This resource is unavailable in Grafana.">
      <div>Grafana page</div>
    </DMARouteGuard>
  );
}

describe('DMARouteGuard', () => {
  it('renders children instead of handing off when the caller supplies no plugin destination', () => {
    // The caller refused the request (e.g. missing permission), so `children` holds that answer and
    // must not be pre-empted by the plugin redirect.
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.ManagedByPlugin });

    renderGuard({ pluginDestination: undefined });

    expect(screen.getByText('Grafana page')).toBeInTheDocument();
    expect(screen.queryByText('Plugin page')).not.toBeInTheDocument();
  });

  it.each([
    [DMAStatus.Loading, 'Loading DMA status'],
    [DMAStatus.ManagedByPlugin, 'Plugin page'],
    [DMAStatus.ManagedByGrafana, 'Grafana page'],
  ])('renders the expected destination for %s', (status, expectedText) => {
    useDMAStatusMock.mockReturnValue({ status });

    renderGuard();

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('offers plugin installation or enablement when DMA is unavailable', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.NotAvailable });

    renderGuard();

    expect(screen.getByRole('alert')).toHaveTextContent('This resource is unavailable in Grafana.');
    expect(screen.getByRole('link', { name: 'Install or enable the Prometheus Alerting plugin' })).toHaveAttribute(
      'href',
      '/plugins/grafana-prometheusalerting-app'
    );
  });
});
