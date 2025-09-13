import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { mockLocalStorage } from 'app/features/alerting/unified/mocks';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DashboardScene } from '../../DashboardScene';
import { DashboardGridItem } from '../../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { MakeDashboardEditableButton } from './MakeDashboardEditableButton';

// Mock the DashboardInteractions module
jest.mock('app/features/dashboard-scene/utils/interactions', () => ({
  DashboardInteractions: {
    editButtonClicked: jest.fn(),
    exitEditButtonClicked: jest.fn(),
  },
}));

const localStorageMock = mockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

export function buildTestScene(isEditing = false) {
  const testScene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: isEditing,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
  testScene.exitEditMode = jest.fn();
  activateFullSceneTree(testScene);
  return testScene;
}

describe('MakeDashboardEditableButton', () => {
    afterEach(() => {
    jest.resetAllMocks();
    localStorageMock.clear();
  });

  describe('edit dashboard button tracking', () => {
    it('should call DashboardInteractions.editButtonClicked with outlineExpanded:true if grafana.dashboard.edit-pane.outline.collapsed is undefined', async () => {
      render(<MakeDashboardEditableButton dashboard={buildTestScene()} />);
      await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
      expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: false });
    });

    it('should call DashboardInteractions.editButtonClicked with outlineExpanded:true if grafana.dashboard.edit-pane.outline.collapsed is false', async () => {
      localStorageMock.setItem('grafana.dashboard.edit-pane.outline.collapsed', 'false');
      render(<MakeDashboardEditableButton dashboard={buildTestScene()} />);
      await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
      expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: true });
    });

    it('should call DashboardInteractions.editButtonClicked with outlineExpanded:false if grafana.dashboard.edit-pane.outline.collapsed is true', async () => {
      localStorageMock.setItem('grafana.dashboard.edit-pane.outline.collapsed', 'true');
      render(<MakeDashboardEditableButton dashboard={buildTestScene()} />);
      await userEvent.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.editButton));
      expect(DashboardInteractions.editButtonClicked).toHaveBeenCalledWith({ outlineExpanded: false });
    });
  });
});
