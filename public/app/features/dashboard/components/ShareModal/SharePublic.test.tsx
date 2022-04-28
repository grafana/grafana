import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import config from 'app/core/config';
import { DashboardModel, PanelModel } from '../../state';
import { ShareModal } from './ShareModal';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
    appEvents: {
      subscribe: () => {
        return { unsubscribe: () => {} };
      },
      emit: () => {},
    },
  };
});

describe('SharePublic', () => {
  let originalBootData: any;

  beforeAll(() => {
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

    render(<ShareModal panel={mockPanel} dashboard={mockDashboard} onDismiss={() => console.log('Dismiss!')} />);

    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).not.toHaveTextContent('Share Publicly');
  });

  it('renders share panel when public dashboards feature is enabled', async () => {
    config.featureToggles.publicDashboards = true;
    const mockDashboard = new DashboardModel({
      uid: 'mockDashboardUid',
    });
    const mockPanel = new PanelModel({
      id: 'mockPanelId',
    });

    render(<ShareModal panel={mockPanel} dashboard={mockDashboard} onDismiss={() => console.log('Dismiss!')} />);

    await waitFor(() => screen.getByText('Link'));
    expect(screen.getByRole('tablist')).toHaveTextContent('Link');
    expect(screen.getByRole('tablist')).toHaveTextContent('Share Publicly');

    fireEvent.click(screen.getByText('Share Publicly'));

    await waitFor(() => screen.getByText('Sharing for your dashboard'));
  });
});
