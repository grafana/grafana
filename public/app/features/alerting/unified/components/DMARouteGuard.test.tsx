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

function renderGuard({
  isDataSourceManaged = true,
  pluginPage = <div>Plugin page</div>,
}: {
  isDataSourceManaged?: boolean;
  pluginPage?: ReactNode;
} = {}) {
  return render(
    <DMARouteGuard
      isDataSourceManaged={isDataSourceManaged}
      pluginPage={pluginPage}
      unavailableDescription="This resource is unavailable in Grafana."
    >
      <div>Grafana page</div>
    </DMARouteGuard>
  );
}

describe('DMARouteGuard', () => {
  it('renders Grafana routes without waiting for DMA status', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.Loading });

    renderGuard({ isDataSourceManaged: false, pluginPage: null });

    expect(screen.getByText('Grafana page')).toBeInTheDocument();
  });

  it('shows loading while a DMA route is being resolved', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.Loading });

    renderGuard();

    expect(screen.getByText('Loading DMA status')).toBeInTheDocument();
    expect(screen.queryByText('Grafana page')).not.toBeInTheDocument();
  });

  it('renders the plugin destination when DMA is plugin-managed', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.ManagedByPlugin });

    renderGuard();

    expect(screen.getByText('Plugin page')).toBeInTheDocument();
  });

  it('offers plugin installation when DMA is unavailable', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.NotAvailable });

    renderGuard();

    expect(screen.getByRole('alert')).toHaveTextContent('This resource is unavailable in Grafana.');
    expect(screen.getByRole('link', { name: 'Install the Prometheus Alerting plugin' })).toHaveAttribute(
      'href',
      '/plugins/grafana-prometheusalerting-app'
    );
  });

  it('renders the Grafana page when DMA is Grafana-managed', () => {
    useDMAStatusMock.mockReturnValue({ status: DMAStatus.ManagedByGrafana });

    renderGuard();

    expect(screen.getByText('Grafana page')).toBeInTheDocument();
  });
});
