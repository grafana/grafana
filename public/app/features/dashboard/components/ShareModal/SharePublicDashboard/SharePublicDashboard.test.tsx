import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { BootData } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { BackendSrv, setEchoSrv } from '@grafana/runtime/src';
import config from 'app/core/config';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { configureStore } from 'app/store/configureStore';

import { Echo } from '../../../../../core/services/echo/Echo';
import { ShareModal } from '../ShareModal';

// Mock api request
const publicDashboardconfigResp: PublicDashboard = {
  isEnabled: true,
  uid: '',
  dashboardUid: '',
  accessToken: '',
};

const backendSrv = {
  get: () => publicDashboardconfigResp,
} as unknown as BackendSrv;

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
}));

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
    appEvents: {
      subscribe: () => {
        return {
          unsubscribe: () => {},
        };
      },
      emit: () => {},
    },
  };
});

const renderSharePublicDashboard = (props: React.ComponentProps<typeof ShareModal>) => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <ShareModal {...props} />
    </Provider>
  );
};

describe('SharePublic', () => {
  let originalBootData: BootData;
  let mockDashboard: DashboardModel;
  let mockPanel: PanelModel;

  beforeEach(() => {
    config.featureToggles.publicDashboards = true;
    mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });

    mockPanel = new PanelModel({
      id: 'mockPanelId',
    });
  });

  beforeAll(() => {
    setEchoSrv(new Echo());
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';
    config.bootData = {
      user: {
        orgId: 1,
      },
      navTree: [
        {
          text: 'Section name',
          id: 'section',
          url: 'section',
          children: [
            { text: 'Child1', id: 'child1', url: 'section/child1' },
            { text: 'Child2', id: 'child2', url: 'section/child2' },
          ],
        },
      ],
    } as any;
  });

  afterAll(() => {
    config.bootData = originalBootData;
  });

  it('does not render share panel when public dashboards feature is disabled', () => {
    config.featureToggles.publicDashboards = false;
    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Public dashboard');
  });

  it('renders share panel when public dashboards feature is enabled', async () => {
    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await waitFor(() => screen.getByText('Link'));
    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).toHaveTextContent('Public dashboard');

    fireEvent.click(screen.getByText('Public dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
  });

  it('renders default relative time in input', async () => {
    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });

    //@ts-ignore
    mockDashboard.originalTime = { from: 'now-6h', to: 'now' };

    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await waitFor(() => screen.getByText('Link'));
    fireEvent.click(screen.getByText('Public dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
  });
  it('renders default absolute time in input 2', async () => {
    mockDashboard.time = { from: '2022-08-30T03:00:00.000Z', to: '2022-09-04T02:59:59.000Z' };
    //@ts-ignore
    mockDashboard.originalTime = { from: '2022-08-30T06:00:00.000Z', to: '2022-09-04T06:59:59.000Z' };

    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await waitFor(() => screen.getByText('Link'));
    fireEvent.click(screen.getByText('Public dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
    expect(screen.getByText('2022-08-30 00:00:00 to 2022-09-04 01:59:59')).toBeInTheDocument();
  });
  it('when config is setup for the first time, then save button is disabled', async () => {
    const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await waitFor(() => screen.getByText('Link'));
    fireEvent.click(screen.getByText('Public dashboard'));

    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();
  });
  it('when modal is opened, then loader spinner appears and inputs are disabled', async () => {
    const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

    renderSharePublicDashboard({ panel: mockPanel, dashboard: mockDashboard, onDismiss: () => {} });

    await waitFor(() => screen.getByText('Link'));
    fireEvent.click(screen.getByText('Public dashboard'));

    expect(screen.getByTestId(selectors.WillBePublicCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.LimitedDSCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.CostIncreaseCheckbox)).toBeDisabled();
    expect(screen.getByTestId(selectors.EnableSwitch)).toBeDisabled();
    expect(screen.getByTestId(selectors.SaveConfigButton)).toBeDisabled();

    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  // test checking if current version of dashboard in state is persisted to db
});
