import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { CanvasGridAddActions } from './CanvasGridAddActions';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    trackAddPanelClick: jest.fn(),
    trackGroupRowClick: jest.fn(),
    trackGroupTabClick: jest.fn(),
    trackUngroupClick: jest.fn(),
    trackPastePanelClick: jest.fn(),
  },
}));

// mock getDefaultVizPanel
jest.mock('../../utils/utils', () => ({
  ...jest.requireActual('../../utils/utils'),
  getDefaultVizPanel: () => new VizPanel({ key: 'panel-1', pluginId: 'text' }),
}));

// mock addNew
jest.mock('./addNew', () => ({
  ...jest.requireActual('./addNew'),
  addNewRowTo: jest.fn(),
  addNewTabTo: jest.fn(),
}));

// mock useClipboardState
jest.mock('./useClipboardState', () => ({
  ...jest.requireActual('./useClipboardState'),
  useClipboardState: () => ({
    hasCopiedPanel: true,
  }),
}));

// mock ungroupLayout
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  groupLayout: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

function buildTestScene() {
  const sceneWithNestedLayout = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new TabsLayoutManager({
      tabs: [
        new TabItem({
          title: 'test tab',
          layout: new RowsLayoutManager({
            rows: [
              new RowItem({
                title: 'Test Title',
                layout: new TabsLayoutManager({
                  tabs: [new TabItem({ title: 'Subtab' })],
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  });
  activateFullSceneTree(sceneWithNestedLayout);
  return sceneWithNestedLayout;
}

describe('CanvasGridAddActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('tracking scene actions', () => {
    it('should call DashboardInteractions.trackAddPanelClick when clicking on add panel button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      layoutManager.addPanel = jest.fn();
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addPanel));
      expect(DashboardInteractions.trackAddPanelClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackGroupRowClick when clicking on group into row button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);
      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.groupPanels));

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addRow));
      expect(DashboardInteractions.trackGroupRowClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackGroupTabClick when clicking on group into tab', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.groupPanels));
      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addTab));
      expect(DashboardInteractions.trackGroupTabClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackUngroupClick when clicking on ungroup panels in row layout', async () => {
      const scene = buildTestScene();
      const layoutManager = (scene.state.body as TabsLayoutManager).state.tabs[0].state.layout as RowsLayoutManager;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.ungroup));
      expect(DashboardInteractions.trackUngroupClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackUngroupClick when clicking on ungroup panels in tab layout', async () => {
      const scene = buildTestScene();
      const layoutManager = (
        ((scene.state.body as TabsLayoutManager).state.tabs[0].state.layout as RowsLayoutManager).state.rows[0].state
          .layout as TabsLayoutManager
      ).state.tabs[0].state.layout;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.ungroup));
      expect(DashboardInteractions.trackUngroupClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackPastePanel when clicking on the paste panel button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      layoutManager.pastePanel = jest.fn();
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.pastePanel));
      expect(DashboardInteractions.trackPastePanelClick).toHaveBeenCalled();
    });
  });
});
