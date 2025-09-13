import { screen, render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors } from '@grafana/e2e-selectors';
import { LocationServiceProvider, config, locationService } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, UrlSyncContextProvider, VizPanel } from '@grafana/scenes';
import { mockLocalStorage } from 'app/features/alerting/unified/mocks';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';
import { DashboardMeta } from 'app/types/dashboard';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardInteractions } from '../utils/interactions';

import { DashboardScene } from './DashboardScene';
import { ToolbarActions } from './NavToolbarActions';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    editButtonClicked: jest.fn(),
  },
}));

const localStorageMock = mockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

jest.mock('app/features/playlist/PlaylistSrv', () => ({
  playlistSrv: {
    useState: jest.fn().mockReturnValue({ isPlaying: false }),
    setState: jest.fn(),
    isPlaying: true,
    start: jest.fn(),
    next: jest.fn(),
    prev: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: jest.fn(),
    getInstanceSettings: jest.fn().mockReturnValue({
      uid: 'datasource-uid',
      name: 'datasource-name',
    }),
  }),
}));

describe('NavToolbarActions', () => {
  describe('Given an already saved dashboard', () => {
    it('Should show correct buttons when not in editing', async () => {
      setup();

      expect(screen.queryByText('Save dashboard')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Add')).not.toBeInTheDocument();
      expect(await screen.findByText('Edit')).toBeInTheDocument();
      expect(await screen.findByText('Share')).toBeInTheDocument();
    });

    it('Should show the correct buttons when playing a playlist', async () => {
      jest.mocked(playlistSrv).useState.mockReturnValueOnce({ isPlaying: true });
      setup();

      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next)).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Share')).not.toBeInTheDocument();
    });

    it('Should call the playlist srv when using playlist controls', async () => {
      jest.mocked(playlistSrv).useState.mockReturnValueOnce({ isPlaying: true });
      setup();

      // Previous dashboard
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev)).toBeInTheDocument();
      await userEvent.click(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.prev));
      expect(playlistSrv.prev).toHaveBeenCalledTimes(1);

      // Next dashboard
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next)).toBeInTheDocument();
      await userEvent.click(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.next));
      expect(playlistSrv.next).toHaveBeenCalledTimes(1);

      // Stop playlist
      expect(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop)).toBeInTheDocument();
      await userEvent.click(await screen.findByTestId(selectors.pages.Dashboard.DashNav.playlistControls.stop));
      expect(playlistSrv.stop).toHaveBeenCalledTimes(1);
    });

    it('Should hide the playlist controls when it is not playing', async () => {
      setup();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.prev)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.stop)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.next)).not.toBeInTheDocument();
    });

    it('Should show correct buttons when editing', async () => {
      setup();

      await userEvent.click(await screen.findByText('Edit'));

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Exit edit')).toBeInTheDocument();
      expect(await screen.findByText('Add')).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Share')).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.prev)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.stop)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.next)).not.toBeInTheDocument();
    });

    it('Should show correct buttons when in settings menu', async () => {
      setup();

      await userEvent.click(await screen.findByText('Edit'));
      await userEvent.click(await screen.findByText('Settings'));

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Back to dashboard')).toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.prev)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.stop)).not.toBeInTheDocument();
      expect(screen.queryByText(selectors.pages.Dashboard.DashNav.playlistControls.next)).not.toBeInTheDocument();
    });

    it('Should show correct buttons when editing a new panel', async () => {
      const { dashboard } = setup();

      await act(() => {
        dashboard.onEnterEditMode();
        const panel = dashboard.state.body.getVizPanels()[0];
        dashboard.setState({ editPanel: buildPanelEditScene(panel, true) });
      });

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Discard panel')).toBeInTheDocument();
      expect(await screen.findByText('Back to dashboard')).toBeInTheDocument();
    });

    it('Should show correct buttons when editing an existing panel', async () => {
      const { dashboard } = setup();

      await act(() => {
        dashboard.onEnterEditMode();
        const panel = dashboard.state.body.getVizPanels()[0];
        dashboard.setState({ editPanel: buildPanelEditScene(panel) });
      });

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Discard panel changes')).toBeInTheDocument();
      expect(await screen.findByText('Back to dashboard')).toBeInTheDocument();
    });
    describe('edit dashboard button tracking', () => {
      it('should call DashboardInteractions.editButtonClicked with outlineExpanded:true if grafana.dashboard.edit-pane.outline.collapsed is undefined', async () => {
        setup();
        await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
        expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: false });
      });

      it('should call DashboardInteractions.editButtonClicked with outlineExpanded:true if grafana.dashboard.edit-pane.outline.collapsed is false', async () => {
        localStorageMock.setItem('grafana.dashboard.edit-pane.outline.collapsed', 'false');
        setup();
        await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
        expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: true });
      });

      it('should call DashboardInteractions.editButtonClicked with outlineExpanded:false if grafana.dashboard.edit-pane.outline.collapsed is true', async () => {
        localStorageMock.setItem('grafana.dashboard.edit-pane.outline.collapsed', 'true');
        setup();
        await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
        expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: false });
      });
    });
  });

  describe('Given new sharing button', () => {
    it('Should show old share button when newDashboardSharingComponent FF is disabled', async () => {
      setup();

      expect(await screen.findByText('Share')).toBeInTheDocument();
      const newShareButton = screen.queryByTestId(selectors.pages.Dashboard.DashNav.newShareButton.container);
      expect(newShareButton).not.toBeInTheDocument();
      const newExportButton = screen.queryByRole('button', { name: /export dashboard/i });
      expect(newExportButton).not.toBeInTheDocument();
    });
    it('Should show new share button when newDashboardSharingComponent FF is enabled', async () => {
      config.featureToggles.newDashboardSharingComponent = true;
      setup();

      expect(await screen.queryByTestId(selectors.pages.Dashboard.DashNav.shareButton)).not.toBeInTheDocument();
      const newShareButton = screen.getByTestId(selectors.pages.Dashboard.DashNav.newShareButton.container);
      expect(newShareButton).toBeInTheDocument();
    });
    it('Should show new export button when newDashboardSharingComponent FF is enabled', async () => {
      config.featureToggles.newDashboardSharingComponent = true;
      setup();
      const newExportButton = screen.getByRole('button', { name: /export dashboard/i });
      expect(newExportButton).toBeInTheDocument();
    });
  });

  describe('Snapshot', () => {
    it('should show link button when is a snapshot', () => {
      setup({
        isSnapshot: true,
      });

      expect(screen.queryByTestId('button-snapshot')).toBeInTheDocument();
    });
  });
});

function setup(meta?: DashboardMeta) {
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    meta: {
      canEdit: true,
      isNew: false,
      canMakeEditable: true,
      canSave: true,
      canShare: true,
      canStar: true,
      canAdmin: true,
      canDelete: true,
      ...meta,
    },
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),
      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  const context = getGrafanaContextMock();

  locationService.push('/');

  render(
    <TestProvider grafanaContext={context}>
      <LocationServiceProvider service={locationService}>
        <UrlSyncContextProvider scene={dashboard}>
          <ToolbarActions dashboard={dashboard} />
        </UrlSyncContextProvider>
      </LocationServiceProvider>
    </TestProvider>
  );

  const actions = context.chrome.state.getValue().actions;

  return { dashboard, actions };
}
