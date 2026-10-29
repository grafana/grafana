import { act } from '@testing-library/react';
import { type PointerEvent as ReactPointerEvent } from 'react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { logError, setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import {
  SceneGridLayout,
  SceneGridLayoutDragStartEvent,
  SceneGridRow,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../../../sidebar/events';
import { DashboardScene } from '../../DashboardScene';
import { DASHBOARD_DROP_TARGET_KEY_ATTR, isDashboardDropTarget } from '../../types/DashboardDropTarget';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import { shouldRenderCustomGrid } from './CustomGrid';
import { CustomGridRenderer } from './CustomGridRenderer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logError: jest.fn(),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [jest.fn(), { width: 1200, height: 800, x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 }],
}));

jest.mock('./CustomGridRenderer', () => {
  const actual = jest.requireActual('./CustomGridRenderer');
  return { ...actual, CustomGridRenderer: jest.fn(actual.CustomGridRenderer) };
});

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'text' }, () => <div>Panel content</div>)),
  getPanelPluginFromCache: () => undefined,
});

const CUSTOM_GRID = '[data-custom-grid]';
const REACT_GRID_LAYOUT = '.react-grid-layout';

function gridItem(id: number, x: number, y: number) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    x,
    y,
    width: 12,
    height: 8,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text' }),
  });
}

function createManager() {
  const grid = new SceneGridLayout({ children: [gridItem(1, 0, 0), gridItem(2, 12, 0)] });
  return new DefaultGridLayoutManager({ grid });
}

async function renderManager(manager: DefaultGridLayoutManager, isEditing = true) {
  const scene = new DashboardScene({ title: 'Grid', $timeRange: new SceneTimeRange({}), body: manager, isEditing });
  const result = render(<manager.Component model={manager} />);
  // Let the panels finish loading their plugin
  await act(async () => {});
  return { ...result, scene };
}

afterEach(() => {
  setTestFlags({});
  jest.mocked(logError).mockClear();
  jest.mocked(CustomGridRenderer).mockImplementation(jest.requireActual('./CustomGridRenderer').CustomGridRenderer);
});

describe('DefaultGridLayoutManager renderer', () => {
  it('renders the react-grid-layout grid while editing with the unified drag and drop flag off', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });

    const { container } = await renderManager(createManager());

    expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
    expect(container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
    expect(container.querySelector('[data-griditem-key="grid-item-2"]')).toHaveTextContent('Panel 2');
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('renders the new grid while editing', async () => {
      const { container } = await renderManager(createManager());

      expect(container.querySelector(CUSTOM_GRID)).toBeInTheDocument();
      expect(container.querySelector(REACT_GRID_LAYOUT)).not.toBeInTheDocument();
      expect(container.querySelector('[data-griditem-key="grid-item-2"]')).toHaveTextContent('Panel 2');
    });

    it('keeps the react-grid-layout grid in view mode', async () => {
      const { container } = await renderManager(createManager(), false);

      expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
    });

    it('switches to the new grid when editing starts', async () => {
      const { container, scene } = await renderManager(createManager(), false);

      await act(async () => scene.setState({ isEditing: true }));

      expect(container.querySelector(CUSTOM_GRID)).toBeInTheDocument();
    });

    it('falls back to the react-grid-layout grid when the new grid throws, and reports it once without identifiers', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.mocked(CustomGridRenderer).mockImplementation(() => {
        throw new Error('Cannot render panel-1 of dashboard abc');
      });
      const manager = createManager();

      const { container, unmount } = await renderManager(manager);

      expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(container.querySelector('[data-griditem-key="grid-item-1"]')).toHaveTextContent('Panel 1');
      expect(logError).toHaveBeenCalledTimes(1);
      const [reported, context] = jest.mocked(logError).mock.calls[0];
      expect(reported.message).toBe('Custom grid failed to render, fell back to the react-grid-layout grid');
      expect(context).toEqual({ errorName: 'Error' });

      // The grid stays on the old renderer when it is rendered again, without another report
      unmount();
      const remounted = render(<manager.Component model={manager} />);
      await act(async () => {});
      expect(remounted.container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(remounted.container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
      expect(logError).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
  });
});

describe('shouldRenderCustomGrid', () => {
  it('is false with the unified drag and drop flag off', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });

    expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(false);
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('is true for an editing session, whatever its mode', () => {
      expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(true);
    });

    it('is false outside of an editing session', () => {
      expect(shouldRenderCustomGrid(createManager().state.grid, false)).toBe(false);
    });

    it('is false for grids with rows', () => {
      const grid = new SceneGridLayout({ children: [new SceneGridRow({ key: 'row', y: 0, children: [] })] });

      expect(shouldRenderCustomGrid(grid, true)).toBe(false);
    });

    it('is false for grids that fit their panels to the screen', () => {
      const grid = new SceneGridLayout({ children: [gridItem(1, 0, 0)], UNSAFE_fitPanels: true });

      expect(shouldRenderCustomGrid(grid, true)).toBe(false);
    });

    it('is false without the dynamic dashboard layouts', () => {
      setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true, [FlagKeys.DashboardNewLayouts]: false });

      expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(false);
    });
  });
});

describe('DefaultGridLayoutManager drags', () => {
  const GRID_WIDTH = 1200;
  const originalElementsFromPoint = document.elementsFromPoint;
  let clientWidth: jest.SpyInstance;

  beforeEach(() => {
    // jsdom does not lay out, so the grid's container gets the width react-use reports for it
    clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
  });

  afterEach(() => {
    clientWidth.mockRestore();
    document.elementsFromPoint = originalElementsFromPoint;
  });

  async function renderEditingManager() {
    const manager = createManager();
    const rendered = await renderManager(manager);
    // Editing makes the grid draggable after a short delay
    act(() => manager.state.grid.setState({ isDraggable: true, isResizable: true }));
    return { manager, ...rendered };
  }

  /** Presses a panel's drag handle, as the panel header does */
  function pressDragHandle(manager: DefaultGridLayoutManager, panelKey: string, clientX: number, clientY: number) {
    const panel = manager.getVizPanels().find((candidate) => candidate.state.key === panelKey)!;
    const handle = document.createElement('div');
    handle.className = manager.state.grid.getDragClass();
    // Only the fields the drag start reads
    const evt = { button: 0, clientX, clientY, target: handle } as unknown as ReactPointerEvent;
    act(() => panel.publishEvent(new SceneGridLayoutDragStartEvent({ evt, panel }), true));
    return { evt, gridItem: panel.parent };
  }

  function recordEdits(scene: DashboardScene) {
    const edits: DashboardEditActionEventPayload[] = [];
    scene.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
      payload.perform();
      edits.push(payload);
    });
    return edits;
  }

  function placements(manager: DefaultGridLayoutManager) {
    return manager.state.grid.state.children.map(({ state: { key, x, y } }) => ({ key, x, y }));
  }

  it('is not a drop target and hands drags to the layout orchestrator as before with the flag off', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });
    const { manager, scene } = await renderEditingManager();
    const startDraggingSync = jest.spyOn(scene.state.layoutOrchestrator!, 'startDraggingSync');

    const { evt, gridItem } = pressDragHandle(manager, 'panel-2', 620, 10);

    expect(isDashboardDropTarget(manager)).toBe(false);
    expect(startDraggingSync.mock.calls).toEqual([[evt, gridItem]]);
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('is a drop target only while the new grid renders it', async () => {
      const { manager, scene } = await renderEditingManager();
      expect(isDashboardDropTarget(manager)).toBe(true);

      await act(async () => scene.setState({ isEditing: false }));

      expect(isDashboardDropTarget(manager)).toBe(false);
    });

    it('moves a panel dragged within the grid on drop, as one undoable edit', async () => {
      const { manager, scene, container } = await renderEditingManager();
      const edits = recordEdits(scene);
      const gridContainer = container.querySelector(`${CUSTOM_GRID} > div`)!;
      document.elementsFromPoint = () => [gridContainer];

      // Grab Panel 2 at its top-left corner and drop it below Panel 1
      pressDragHandle(manager, 'panel-2', 604, 0);
      expect(gridContainer).toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, manager.state.key);
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 8 * 38, buttons: 1 }));
      });
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 8 * 38 }));
      });

      expect(edits.map(({ meta }) => meta)).toEqual([{ actionId: 'panel.move', scope: 'custom-grid' }]);
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 0, y: 8 },
      ]);
      expect(gridContainer).not.toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR);
      expect(scene.state.layoutOrchestrator!.isDragging()).toBe(false);

      act(() => edits[0].undo());
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 12, y: 0 },
      ]);
    });

    it('cancels the drag in the layout orchestrator too when Escape is pressed', async () => {
      const { manager, scene, container } = await renderEditingManager();
      const edits = recordEdits(scene);
      const gridContainer = container.querySelector(`${CUSTOM_GRID} > div`)!;
      document.elementsFromPoint = () => [gridContainer];
      pressDragHandle(manager, 'panel-2', 604, 0);
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 8 * 38, buttons: 1 }));
      });
      expect(manager.getCustomGridController().getInteraction()).toMatchObject({ isActive: true });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      document.body.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 8 * 38 }));

      expect(scene.state.layoutOrchestrator!.isDragging()).toBe(false);
      expect(edits).toHaveLength(0);
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 12, y: 0 },
      ]);
    });
  });
});
