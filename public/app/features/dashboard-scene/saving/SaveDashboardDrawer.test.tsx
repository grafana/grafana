import { screen, render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { sceneGraph } from '@grafana/scenes';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

describe('SaveDashboardDrawer', () => {
  describe('Given an already saved dashboard', () => {
    it('should render save drawer with only message textarea', async () => {
      setup().openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Save current time range')).not.toBeInTheDocument();
      expect(screen.getByText('No changes to save')).toBeInTheDocument();
      expect(screen.queryByLabelText('Tab Changes')).not.toBeInTheDocument();
    });

    it('When there are no changes', async () => {
      setup().openAndRender();
      expect(screen.getByText('No changes to save')).toBeInTheDocument();
    });

    it('When time range changed show save time range option', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Save current time range')).toBeInTheDocument();
    });

    it('Should update diff when including time range is checked', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Save current time range')).toBeInTheDocument();
      expect(screen.queryByLabelText('Tab Changes')).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText(selectors.pages.SaveDashboardModal.saveTimerange));

      expect(await screen.findByLabelText('Tab Changes')).toBeInTheDocument();
    });
  });
});

interface ScenarioOptions {}

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
    meta: {},
  });

  // Clear any data layers
  dashboard.setState({ $data: undefined });

  cleanUp();
  cleanUp = dashboard.activate();

  dashboard.onEnterEditMode();

  const openAndRender = () => {
    dashboard.openSaveDrawer({});
    const drawer = dashboard.state.overlay as SaveDashboardDrawer;
    render(
      <TestProvider>
        <drawer.Component model={drawer} />
      </TestProvider>
    );

    return drawer;
  };

  //  await act(() => Promise.resolve());
  return { dashboard, openAndRender };
}
