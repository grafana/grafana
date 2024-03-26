import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors } from '@grafana/e2e-selectors';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { ToolbarActions } from './NavToolbarActions';

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

describe('NavToolbarActions', () => {
  describe('Give an already saved dashboard', () => {
    it('Should show correct buttons when not in editing', async () => {
      setup();

      expect(screen.queryByText('Save dashboard')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Add visualization')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Add row')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Paste panel')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Add library panel')).not.toBeInTheDocument();
      expect(await screen.findByText('Edit')).toBeInTheDocument();
      expect(await screen.findByText('Share')).toBeInTheDocument();
    });

    it('Should the correct buttons when playing a playlist', async () => {
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
      expect(await screen.findByLabelText('Add visualization')).toBeInTheDocument();
      expect(await screen.findByLabelText('Add row')).toBeInTheDocument();
      expect(await screen.findByLabelText('Paste panel')).toBeInTheDocument();
      expect(await screen.findByLabelText('Add library panel')).toBeInTheDocument();
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
  });
});

let cleanUp = () => {};

function setup() {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [],
      version: 10,
    },
    meta: {
      canSave: true,
    },
  });

  // Clear any data layers
  dashboard.setState({ $data: undefined });

  const initialSaveModel = transformSceneToSaveModel(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  dashboard.startUrlSync();

  cleanUp();
  cleanUp = dashboard.activate();

  const context = getGrafanaContextMock();

  render(
    <TestProvider grafanaContext={context}>
      <ToolbarActions dashboard={dashboard} />
    </TestProvider>
  );

  const actions = context.chrome.state.getValue().actions;

  return { dashboard, actions };
}
