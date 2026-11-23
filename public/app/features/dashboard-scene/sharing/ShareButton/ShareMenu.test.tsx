import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService, usePluginLinks } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { ModalRoot } from '@grafana/ui';
import { ModalsContextProvider } from 'app/core/context/ModalsContextProvider';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions } from '../../../alerting/unified/mocks';
import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { type DashboardSceneState } from '../../scene/types/dashboard';
import { DashboardInteractions } from '../../utils/interactions';

import ShareMenu from './ShareMenu';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

const usePluginLinksMock = jest.mocked(usePluginLinks);

const createAndCopyDashboardShortLinkMock = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyDashboardShortLink: () => createAndCopyDashboardShortLinkMock(),
}));

const selector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

describe('ShareMenu', () => {
  beforeEach(() => {
    usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
  });

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
  });

  it('should not share externally when public dashboard is disabled', async () => {
    config.publicDashboardsEnabled = false;
    setup();

    expect(screen.queryByTestId(selector.shareExternally)).not.toBeInTheDocument();
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

  describe('plugin links', () => {
    const pluginItemTestId = 'plugin:grafana-test-app:test-link';

    it('should show a plugin link on the dashboard share menu', async () => {
      usePluginLinksMock.mockReturnValue({ links: [createLink({ onClick: jest.fn() })], isLoading: false });
      setup({ meta: { folderUid: 'folder-1', folderTitle: 'Folder' } });

      expect(await screen.findByText('Test link')).toBeInTheDocument();
      expect(usePluginLinksMock).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionPointId: 'grafana/dashboard/share/v1',
          context: { dashboardUid: 'dash-1', dashboardTitle: 'hello', folderUid: 'folder-1', folderTitle: 'Folder' },
        })
      );
    });

    it('should show only the link title, like the other share items', async () => {
      usePluginLinksMock.mockReturnValue({
        links: [createLink({ description: 'Link description', onClick: jest.fn() })],
        isLoading: false,
      });
      setup();

      expect(await screen.findByText('Test link')).toBeInTheDocument();
      expect(screen.queryByText('Link description')).not.toBeInTheDocument();
    });

    it('should call the link onClick and track the click', async () => {
      const onClick = jest.fn();
      const trackSpy = jest.spyOn(DashboardInteractions, 'sharingCategoryClicked');
      usePluginLinksMock.mockReturnValue({ links: [createLink({ onClick })], isLoading: false });
      setup();

      await userEvent.click(await screen.findByTestId(pluginItemTestId));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ item: pluginItemTestId }));
    });

    it('should navigate to the link path when there is no onClick', async () => {
      const pushSpy = jest.spyOn(locationService, 'push');
      usePluginLinksMock.mockReturnValue({
        links: [createLink({ path: '/a/grafana-test-app/page' })],
        isLoading: false,
      });
      setup();

      await userEvent.click(await screen.findByTestId(pluginItemTestId));

      expect(pushSpy).toHaveBeenCalledWith('/a/grafana-test-app/page');
    });

    it('should not show plugin links on the panel share menu', () => {
      usePluginLinksMock.mockReturnValue({ links: [createLink({ onClick: jest.fn() })], isLoading: false });
      setup(undefined, { forPanel: true });

      expect(screen.queryByTestId(pluginItemTestId)).not.toBeInTheDocument();
    });

    it('should show the save before share modal when the dashboard has unsaved edits', async () => {
      const onClick = jest.fn();
      usePluginLinksMock.mockReturnValue({ links: [createLink({ onClick })], isLoading: false });
      setup({ isEditing: true, isDirty: true, meta: { canSave: true } });

      await userEvent.click(await screen.findByTestId(pluginItemTestId));

      expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

function createLink(overrides: Partial<PluginExtensionLink>): PluginExtensionLink {
  return {
    id: 'test-link',
    type: PluginExtensionTypes.link,
    pluginId: 'grafana-test-app',
    title: 'Test link',
    description: '',
    ...overrides,
  };
}

function setup(overrides?: Partial<DashboardSceneState>, { forPanel = false } = {}) {
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

  render(
    <ModalsContextProvider>
      <ShareMenu dashboard={dashboard} panel={forPanel ? panel : undefined} />
      <ModalRoot />
    </ModalsContextProvider>
  );
}
