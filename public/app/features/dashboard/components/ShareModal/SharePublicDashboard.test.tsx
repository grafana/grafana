import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { BootData } from '@grafana/data';
import { BackendSrv, setEchoSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { Echo } from '../../../../core/services/echo/Echo';

import { ShareModal } from './ShareModal';
import { PublicDashboard } from './SharePublicDashboardUtils';

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

describe('SharePublic', () => {
  let originalBootData: BootData;

  beforeAll(() => {
    setEchoSrv(new Echo());
    originalBootData = config.bootData;
    config.appUrl = 'http://dashboards.grafana.com/';

    config.bootData = {
      user: {
        orgId: 1,
      },
    } as any;
  });

  afterAll(() => {
    config.bootData = originalBootData;
  });

  it('does not render share panel when public dashboards feature is disabled', () => {
    const mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });

    render(<ShareModal panel={mockPanel} dashboard={mockDashboard} onDismiss={() => {}} />);

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Public Dashboard');
  });

  it('renders share panel when public dashboards feature is enabled', async () => {
    config.featureToggles.publicDashboards = true;
    const mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });

    render(<ShareModal panel={mockPanel} dashboard={mockDashboard} onDismiss={() => {}} />);

    await waitFor(() => screen.getByText('Link'));
    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).toHaveTextContent('Public Dashboard');

    fireEvent.click(screen.getByText('Public Dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
  });

  it('renders default time in inputs', async () => {
    config.featureToggles.publicDashboards = true;
    const mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });

    expect(mockDashboard.time).toEqual({ from: 'now-6h', to: 'now' });
    //@ts-ignore
    mockDashboard.originalTime = { from: 'test-from', to: 'test-to' };

    render(<ShareModal panel={mockPanel} dashboard={mockDashboard} onDismiss={() => {}} />);

    await waitFor(() => screen.getByText('Link'));
    fireEvent.click(screen.getByText('Public Dashboard'));

    await screen.findByText('Welcome to Grafana public dashboards alpha!');
    expect(screen.getByDisplayValue('test-from')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-to')).toBeInTheDocument();
  });

  // test checking if current version of dashboard in state is persisted to db
});
