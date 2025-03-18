import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { sceneGraph, SceneRefreshPicker } from '@grafana/scenes';
import { SaveDashboardResponseDTO } from 'app/types';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: {
    validateNewDashboardName: () => true,
  },
}));

const saveDashboardMutationMock = jest.fn();

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

describe('SaveDashboardDrawer', () => {
  describe('Given an already saved dashboard', () => {
    it('should render save drawer with only message textarea', async () => {
      setup().openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).not.toBeInTheDocument();
      expect(screen.getByText('No changes to save')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();
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
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).toBeInTheDocument();
    });

    it('Should update diff when including time range is', async () => {
      const { dashboard, openAndRender } = setup();

      sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

      openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveTimerange)).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.pages.SaveDashboardModal.saveTimerange));

      expect(await screen.findByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    });

    it('When refresh changed show save refresh option', async () => {
      const { dashboard, openAndRender } = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.saveRefresh)).toBeInTheDocument();
    });

    it('Should update diff when including time range is', async () => {
      const { dashboard, openAndRender } = setup();

      const refreshPicker = sceneGraph.findObject(dashboard, (obj) => obj instanceof SceneRefreshPicker);
      if (refreshPicker instanceof SceneRefreshPicker) {
        refreshPicker.setState({ refresh: '5s' });
      }

      openAndRender();

      expect(await screen.findByText('Save dashboard')).toBeInTheDocument();
      expect(screen.getByTestId(selectors.pages.SaveDashboardModal.saveRefresh)).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Changes/ })).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId(selectors.pages.SaveDashboardModal.saveRefresh));

      expect(await screen.findByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    });

    it('Can show changes', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      openAndRender();

      await userEvent.click(await screen.findByRole('tab', { name: /Changes/ }));

      expect(await screen.findByText('Full JSON diff')).toBeInTheDocument();
    });

    it('Can save', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      openAndRender();

      mockSaveDashboard();

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.title).toEqual('New title');
      expect(dashboard.state.version).toEqual(11);
      expect(dashboard.state.uid).toEqual('my-uid-from-resp');
      expect(dashboard.state.isDirty).toEqual(false);
    });

    it('Can handle save errors and overwrite', async () => {
      const { dashboard, openAndRender } = setup();

      dashboard.setState({ title: 'New title' });

      openAndRender();

      mockSaveDashboard({ saveError: 'version-mismatch' });

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      expect(await screen.findByText('Someone else has updated this dashboard')).toBeInTheDocument();
      expect(await screen.findByText('Save and overwrite')).toBeInTheDocument();

      // Now save and overwrite
      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[1][0];
      expect(dataSent.overwrite).toEqual(true);
    });
  });

  describe('Save as copy', () => {
    it('Should show save as form', async () => {
      const { openAndRender } = setup();
      openAndRender(true);

      expect(await screen.findByText('Save dashboard copy')).toBeInTheDocument();

      mockSaveDashboard();

      await userEvent.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));

      const dataSent = saveDashboardMutationMock.mock.calls[0][0];
      expect(dataSent.dashboard.uid).toEqual('');
    });
  });
});

interface MockBackendApiOptions {
  saveError: 'version-mismatch' | 'name-exists' | 'plugin-dashboard';
}

function mockSaveDashboard(options: Partial<MockBackendApiOptions> = {}) {
  saveDashboardMutationMock.mockClear();

  if (options.saveError) {
    saveDashboardMutationMock.mockResolvedValue({
      error: { status: 412, data: { status: 'version-mismatch', message: 'sad face' } },
    });

    return;
  }

  saveDashboardMutationMock.mockResolvedValue({
    data: {
      id: 10,
      uid: 'my-uid-from-resp',
      slug: 'my-slug-from-resp',
      status: 'success',
      url: 'my-url',
      version: 11,
      ...options,
    } as SaveDashboardResponseDTO,
  });
}

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

  const initialSaveModel = transformSceneToSaveModel(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  cleanUp();
  cleanUp = dashboard.activate();

  dashboard.onEnterEditMode();

  const openAndRender = (saveAsCopy?: boolean) => {
    dashboard.openSaveDrawer({ saveAsCopy });
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
