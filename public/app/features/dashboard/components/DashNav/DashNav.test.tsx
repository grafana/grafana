import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex, updateNavIndex } from 'app/core/reducers/navModel';
import { KioskMode } from 'app/types/dashboard';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';

import { DashboardModel } from '../../state/DashboardModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { DashNav } from './DashNav';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div data-testid="dashnav-actions">{actions}</div>,
}));

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    getLocation: () => ({ pathname: '/d/test', search: '', hash: '' }),
    partial: jest.fn(),
    getHistory: jest.requireActual('@grafana/runtime').locationService.getHistory,
  },
}));

function setup(dashboard: DashboardModel, kioskMode?: KioskMode | null) {
  return render(
    <MemoryRouter>
      <DashNav
        navIndex={{}}
        dashboard={dashboard}
        title={dashboard.title}
        isFullscreen={false}
        kioskMode={kioskMode}
        hideTimePicker={false}
        folderTitle=""
        removeNavIndex={removeNavIndex}
        setStarred={setStarred}
        updateTimeZoneForSession={updateTimeZoneForSession}
        updateNavIndex={updateNavIndex}
      />
    </MemoryRouter>
  );
}

describe('DashNav', () => {
  let dashboard: DashboardModel;

  beforeEach(() => {
    dashboard = createDashboardModelFixture({
      title: 'Test Dashboard',
      uid: 'test-uid',
    });
    dashboard.meta = {
      ...dashboard.meta,
      canStar: true,
      canSave: true,
      canEdit: true,
      canShare: true,
      showSettings: true,
    };
  });

  describe('in embed kiosk mode', () => {
    it('should only render time controls and hide other actions', () => {
      setup(dashboard, KioskMode.Embed);
      // Star, save, settings, share buttons should NOT be rendered
      expect(screen.queryByRole('button', { name: /mark as favorite/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save dashboard/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /dashboard settings/i })).not.toBeInTheDocument();
    });
  });
});
