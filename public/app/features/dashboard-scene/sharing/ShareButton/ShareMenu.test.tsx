import { render, screen } from '@testing-library/react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { config } from '../../../../core/config';
import { AccessControlAction } from '../../../../types';
import { grantUserPermissions } from '../../../alerting/unified/mocks';
import { DashboardScene, DashboardSceneState } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import ShareMenu from './ShareMenu';

const createAndCopyDashboardShortLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyDashboardShortLink: () => createAndCopyDashboardShortLinkMock(),
}));

const selector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

describe('ShareMenu', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should render menu items', async () => {
    Object.defineProperty(contextSrv, 'isSignedIn', {
      value: true,
    });
    grantUserPermissions([AccessControlAction.SnapshotsCreate, AccessControlAction.OrgUsersAdd]);

    config.publicDashboardsEnabled = true;
    config.snapshotEnabled = true;
    config.externalUserMngLinkUrl = 'http://localhost:3000';
    setup({ meta: { canEdit: true } });

    expect(await screen.findByTestId(selector.shareInternally)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.shareExternally)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.shareSnapshot)).toBeInTheDocument();
    expect(await screen.findByTestId(selector.inviteUser)).toBeInTheDocument();
  });

  it('should not share externally when public dashboard is disabled', async () => {
    config.publicDashboardsEnabled = false;
    setup();

    expect(screen.queryByTestId(selector.shareExternally)).not.toBeInTheDocument();
  });

  it('should not render invite user when user does not have access', async () => {
    Object.defineProperty(contextSrv, 'isSignedIn', {
      value: true,
    });

    expect(await screen.queryByTestId(selector.inviteUser)).not.toBeInTheDocument();
  });

  it('should render invite user with analytics when config is provided', async () => {
    Object.defineProperty(contextSrv, 'isSignedIn', {
      value: true,
    });
    grantUserPermissions([AccessControlAction.OrgUsersAdd]);

    config.externalUserMngLinkUrl = 'http://localhost:3000/users';
    config.externalUserMngAnalytics = true;
    config.externalUserMngAnalyticsParams = 'src=grafananet&other=value1';
    setup({ meta: { canEdit: true } });

    const inviteUser = await screen.findByTestId(selector.inviteUser);
    // Mock window.open
    const windowOpenMock = jest.spyOn(window, 'open').mockImplementation(() => null);

    // Simulate click event
    inviteUser.click();

    // Assert window.open was called with the correct URL
    expect(windowOpenMock).toHaveBeenCalledWith(
      'http://localhost:3000/users?src=grafananet&other=value1&cnt=share-invite',
      '_blank'
    );

    // Restore the original implementation
    windowOpenMock.mockRestore();
  });

  it('should not render invite user when externalUserMngLinkUrl is not provided', async () => {
    Object.defineProperty(contextSrv, 'isSignedIn', {
      value: true,
    });
    grantUserPermissions([AccessControlAction.OrgUsersAdd]);
    config.externalUserMngLinkUrl = '';

    expect(await screen.queryByTestId(selector.inviteUser)).not.toBeInTheDocument();
  });

  describe('ShareSnapshot', () => {
    it('should not share snapshot when user is not signed in', async () => {
      config.snapshotEnabled = true;
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: false,
      });
      setup({ meta: { canEdit: true } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
    it('should not share snapshot when snapshot is not enabled', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      config.snapshotEnabled = false;
      setup({ meta: { canEdit: true } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
    it('should not share snapshot without permissions', async () => {
      Object.defineProperty(contextSrv, 'isSignedIn', {
        value: true,
      });
      config.snapshotEnabled = true;
      setup({ meta: { canEdit: false } });

      expect(screen.queryByTestId(selector.shareSnapshot)).not.toBeInTheDocument();
    });
  });
});

function setup(overrides?: Partial<DashboardSceneState>) {
  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });

  const dashboard = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    ...overrides,
  });

  render(<ShareMenu dashboard={dashboard} />);
}
