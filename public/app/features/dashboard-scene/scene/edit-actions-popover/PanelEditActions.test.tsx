import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { ElementSelectionContext, type ElementSelectionContextItem } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { getCloneKey } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';

import { SHOW_COPIED_DURATION_MS } from './EditActions';
import { EditActionsLayoutProvider } from './EditActionsLayoutContext';
import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { PanelEditActionsBulk, PanelEditActionsSingle, PanelEditActionsWrapper } from './PanelEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    // Activating the dashboard subscribes to app events, and deactivating it unsubscribes.
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    ...jest.requireActual('@grafana/runtime').locationService,
    partial: jest.fn(),
  },
}));
const mockLocationServicePartial = jest.mocked(locationService.partial);

jest.mock('./EditActionsPopover', () => ({
  ...jest.requireActual('./EditActionsPopover'),
  useHoverPopoverSupported: (defaultValue?: boolean) => mockUseHoverPopoverSupported(defaultValue),
}));
const mockUseHoverPopoverSupported = jest.fn((_defaultValue?: boolean) => true);

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

async function hoverAndRest(element: HTMLElement) {
  jest.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.hover(element);
    act(() => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });
  } finally {
    jest.useRealTimers();
  }
}

function buildPanel(index: number) {
  return new VizPanel({ title: `Panel ${index}`, pluginId: 'timeseries', key: `panel-${index}` });
}

function buildTestScene({ panelCount = 1, isEditing = true }: { panelCount?: number; isEditing?: boolean } = {}) {
  const panels = Array.from({ length: panelCount }, (_, index) => buildPanel(index + 1));
  const layoutManager = DefaultGridLayoutManager.fromVizPanels(panels);
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing,
    body: layoutManager,
  });
  return { scene, layoutManager, panels };
}

function buildTestSceneWithRepeatedPanels({
  cloneCountPerRepeat = 1,
  nonRepeatedPanelCount = 0,
}: { cloneCountPerRepeat?: number; nonRepeatedPanelCount?: number } = {}) {
  const sourcePanel = buildPanel(1);
  const clonedPanels = Array.from(
    { length: cloneCountPerRepeat },
    (_, index) =>
      new VizPanel({
        title: 'Panel 1',
        pluginId: 'timeseries',
        key: getCloneKey('panel-1', index + 1),
        repeatSourceKey: 'panel-1',
      })
  );
  const nonRepeatedPanels = Array.from({ length: nonRepeatedPanelCount }, (_, index) => buildPanel(index + 2));
  const layoutManager = DefaultGridLayoutManager.fromGridItems([
    new DashboardGridItem({ body: sourcePanel, repeatedPanels: clonedPanels }),
    ...nonRepeatedPanels.map((panel) => new DashboardGridItem({ body: panel })),
  ]);
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: layoutManager,
  });

  return { scene, sourcePanel, clonedPanels, nonRepeatedPanels };
}

function buildTestSceneWithPanelsInTwoRows() {
  const panels = [buildPanel(1), buildPanel(2)];
  const rows = panels.map(
    (panel, index) =>
      new RowItem({
        key: `row-${index + 1}`,
        title: `Row ${index + 1}`,
        layout: DefaultGridLayoutManager.fromVizPanels([panel]),
      })
  );
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new RowsLayoutManager({ rows }),
  });

  return { scene, rows, panels };
}

describe('<PanelEditActionsSingle />', () => {
  function renderPanelEditActionsSingle({ panel }: { panel: VizPanel }) {
    const renderResult = render(<PanelEditActionsSingle panel={panel} />);

    const { user } = renderResult;

    const elements = {
      settings: () => renderResult.getByRole('button', { name: 'Settings' }),
      editVisualization: () => renderResult.getByRole('button', { name: 'Edit visualization' }),
      copy: () => renderResult.getByRole('button', { name: 'Copy to clipboard' }),
      duplicate: () => renderResult.getByRole('button', { name: 'Duplicate' }),
      delete: () => renderResult.getByRole('button', { name: 'Delete' }),
      tooltip: () => renderResult.getByRole('tooltip'),
      // A disabled control takes its accessible name from the tooltip explaining why it is disabled.
      disabledCopy: () => renderResult.getByRole('button', { name: "Repeated panels can't be copied individually" }),
      disabledDuplicate: () =>
        renderResult.getByRole('button', { name: "Repeated panels can't be duplicated individually" }),
      disabledDelete: () => renderResult.getByRole('button', { name: "Repeated panels can't be deleted individually" }),
    };

    return {
      ...renderResult,
      elements,
      actions: {
        clickSettings: () => user.click(elements.settings()),
        clickEditVisualization: () => user.click(elements.editVisualization()),
        clickCopy: () => user.click(elements.copy()),
        clickDuplicate: () => user.click(elements.duplicate()),
        clickDelete: () => user.click(elements.delete()),
      },
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('renders Settings, Edit visualization, Copy, Duplicate, and Delete controls', () => {
    const { panels } = buildTestScene();

    const { elements } = renderPanelEditActionsSingle({ panel: panels[0] });

    expect(elements.settings()).toBeInTheDocument();
    expect(elements.editVisualization()).toBeInTheDocument();
    expect(elements.copy()).toBeInTheDocument();
    expect(elements.duplicate()).toBeInTheDocument();
    expect(elements.delete()).toBeInTheDocument();
  });

  test('when the user clicks Settings, the panel is selected via the sidebar', async () => {
    const { scene, panels } = buildTestScene();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()).toBe(panels[0]);
  });

  test('when the user clicks Settings, the click is reported as coming from the edit popover', async () => {
    const { panels } = buildTestScene();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickSettings();

    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('settings', 1, 'edit_popover');
  });

  test('when the panel is a repeat clone and the user clicks Settings, the source panel is selected', async () => {
    const { scene, sourcePanel, clonedPanels } = buildTestSceneWithRepeatedPanels();
    const { actions } = renderPanelEditActionsSingle({ panel: clonedPanels[0] });

    await actions.clickSettings();

    expect(scene.state.sidebar.getSelectedObject()).toBe(sourcePanel);
  });

  test('when the user clicks Edit visualization, the panel editor is opened', async () => {
    const { panels } = buildTestScene();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickEditVisualization();

    expect(mockLocationServicePartial).toHaveBeenCalledWith({ editPanel: 1 });
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('configure', 1, 'edit_popover');
  });

  test('when the user clicks Duplicate, the panel is duplicated via its layout manager', async () => {
    const { layoutManager, panels } = buildTestScene();
    const duplicatePanel = jest.spyOn(layoutManager, 'duplicatePanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickDuplicate();

    expect(duplicatePanel).toHaveBeenCalledWith(panels[0]);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('duplicate', 1, 'edit_popover');
  });

  test('when the user clicks Delete and confirms, the panel is removed via its layout manager', async () => {
    const { layoutManager, panels } = buildTestScene();
    const removePanel = jest.spyOn(layoutManager, 'removePanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickDelete();

    const [event] = mockPublishAppEvent.mock.calls[0];
    expect(event).toBeInstanceOf(ShowConfirmModalEvent);
    expect(event.payload.title).toBe('Delete panel?');
    expect(event.payload.text).toContain('Deleting this panel will also remove all queries');
    expect(event.payload.yesText).toBe('Delete');
    expect(removePanel).not.toHaveBeenCalled();

    event.payload.onConfirm();

    expect(removePanel).toHaveBeenCalledWith(panels[0]);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('delete', 1, 'edit_popover');
  });

  test('when the user clicks Delete and confirms, the panel removal is reported as an edit action from the popover', async () => {
    const { layoutManager, panels } = buildTestScene();
    jest.spyOn(layoutManager, 'removePanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    jest.spyOn(DashboardInteractions, 'trackDeleteDashboardElement').mockImplementation();
    const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

    await actions.clickDelete();
    const [event] = mockPublishAppEvent.mock.calls[0];
    event.payload.onConfirm();

    expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('Panel', 'edit_popover');
  });

  describe('Copy to clipboard', () => {
    describe('when the user hovers over the control', () => {
      test('shows a Copy to clipboard tooltip', async () => {
        const { panels } = buildTestScene();
        const { user, elements } = renderPanelEditActionsSingle({ panel: panels[0] });

        await user.hover(elements.copy());

        expect(elements.tooltip()).toHaveTextContent('Copy to clipboard');
      });
    });

    describe('when the user clicks on the control', () => {
      test('the panel is copied via the dashboard', async () => {
        const { scene, panels } = buildTestScene();
        const copyPanel = jest.spyOn(scene, 'copyPanel').mockImplementation();
        jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
        const { actions } = renderPanelEditActionsSingle({ panel: panels[0] });

        await actions.clickCopy();

        expect(copyPanel).toHaveBeenCalledWith(panels[0]);
        expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('copy', 1, 'edit_popover');
      });

      test('shows a Copied tooltip that disappears after 2 seconds', () => {
        jest.useFakeTimers();
        const { panels } = buildTestScene();
        jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
        const { elements } = renderPanelEditActionsSingle({ panel: panels[0] });

        fireEvent.click(elements.copy());

        expect(elements.tooltip()).toHaveTextContent('Copied');

        act(() => {
          jest.advanceTimersByTime(SHOW_COPIED_DURATION_MS);
        });

        expect(screen.queryByText('Copied')).not.toBeInTheDocument();
      });

      test('if the Copied tooltip has disappeared, then hovering again over the control shows a Copy to clipboard tooltip', async () => {
        jest.useFakeTimers();
        const { panels } = buildTestScene();
        jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
        const { user, elements } = renderPanelEditActionsSingle({ panel: panels[0] });

        fireEvent.click(elements.copy());

        act(() => {
          jest.advanceTimersByTime(SHOW_COPIED_DURATION_MS);
        });
        jest.useRealTimers();

        await user.hover(elements.copy());

        expect(elements.tooltip()).toHaveTextContent('Copy to clipboard');
      });
    });
  });

  test('when the panel is a repeat clone, Copy, Duplicate and Delete are disabled and Settings and Edit visualization stay enabled', () => {
    const { clonedPanels } = buildTestSceneWithRepeatedPanels();

    const { elements } = renderPanelEditActionsSingle({ panel: clonedPanels[0] });

    expect(elements.settings()).toBeEnabled();
    expect(elements.editVisualization()).toBeEnabled();
    expect(elements.disabledCopy()).toBeDisabled();
    expect(elements.disabledDuplicate()).toBeDisabled();
    expect(elements.disabledDelete()).toBeDisabled();
  });
});

describe('<PanelEditActionsBulk />', () => {
  let deactivate: (() => void) | undefined;

  function renderPanelEditActionsBulk({
    panel,
    selected,
  }: {
    panel: VizPanel;
    selected: ElementSelectionContextItem[];
  }) {
    const renderResult = render(
      <ElementSelectionContext.Provider value={{ enabled: true, selected, onSelect: jest.fn(), onClear: jest.fn() }}>
        <PanelEditActionsBulk panel={panel} />
      </ElementSelectionContext.Provider>
    );

    const { user } = renderResult;

    const elements = {
      groupIntoRow: () => renderResult.getByRole('button', { name: 'Group into row' }),
      groupIntoTab: () => renderResult.getByRole('button', { name: 'Group into tab' }),
      delete: () => renderResult.getByRole('button', { name: 'Delete' }),
      // Both group controls take their accessible name from the tooltip explaining why they are
      // disabled, and that reason is the same for either target.
      groupControlsDisabledFor: (reason: string) => renderResult.getAllByRole('button', { name: reason }),
    };

    return {
      ...renderResult,
      elements,
      actions: {
        clickGroupIntoRow: () => user.click(elements.groupIntoRow()),
        clickGroupIntoTab: () => user.click(elements.groupIntoTab()),
        clickDelete: () => user.click(elements.delete()),
      },
    };
  }

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('when two panels are selected, the label reads 2 panels selected', () => {
    const { panels } = buildTestScene({ panelCount: 2 });
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    renderPanelEditActionsBulk({ panel: panels[0], selected });

    expect(screen.getByText('2 panels selected')).toBeInTheDocument();
  });

  test('when a selected panel is repeated, its rendered clones are counted too', () => {
    const { sourcePanel, nonRepeatedPanels } = buildTestSceneWithRepeatedPanels({
      cloneCountPerRepeat: 1,
      nonRepeatedPanelCount: 1,
    });
    const selected = [{ id: sourcePanel.state.key! }, { id: nonRepeatedPanels[0].state.key! }];

    renderPanelEditActionsBulk({ panel: sourcePanel, selected });

    expect(screen.getByText('3 panels selected')).toBeInTheDocument();
  });

  test('when the selection also holds a row, only the selected panels are counted', () => {
    const { rows, panels } = buildTestSceneWithPanelsInTwoRows();
    const selected = [{ id: rows[0].state.key! }, { id: 'panel-1' }, { id: 'panel-2' }];

    renderPanelEditActionsBulk({ panel: panels[0], selected });

    expect(screen.getByText('2 panels selected')).toBeInTheDocument();
  });

  test('when the user clicks Group into row, the selected panels are grouped into a new row', async () => {
    const { scene, panels } = buildTestScene({ panelCount: 2 });
    // Grouping goes through an edit action, which only the activated sidebar handles.
    deactivate = activateFullSceneTree(scene);
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { actions } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    await actions.clickGroupIntoRow();

    const body = scene.state.body;
    if (!(body instanceof RowsLayoutManager)) {
      throw new Error('expected rows layout');
    }
    expect(body.state.rows).toHaveLength(1);
    // Comparing keys rather than the panels themselves: a failing toEqual on scene objects
    // serializes a circular graph and takes the jest worker down with it.
    expect(
      body.state.rows[0]
        .getLayout()
        .getVizPanels()
        .map((panel) => panel.state.key)
    ).toEqual(['panel-1', 'panel-2']);
  });

  test('when the user clicks Group into row, the click is reported as coming from the edit popover', async () => {
    const { scene, panels } = buildTestScene({ panelCount: 2 });
    deactivate = activateFullSceneTree(scene);
    jest.spyOn(DashboardInteractions, 'trackGroupRowClick').mockImplementation();
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { actions } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    await actions.clickGroupIntoRow();

    expect(DashboardInteractions.trackGroupRowClick).toHaveBeenCalledWith('edit_popover');
  });

  test('when the user clicks Group into tab, the click is reported as coming from the edit popover', async () => {
    const { scene, panels } = buildTestScene({ panelCount: 2 });
    deactivate = activateFullSceneTree(scene);
    jest.spyOn(DashboardInteractions, 'trackGroupTabClick').mockImplementation();
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { actions } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    await actions.clickGroupIntoTab();

    expect(DashboardInteractions.trackGroupTabClick).toHaveBeenCalledWith('edit_popover');
  });

  test('when the selection spans two different rows, Group into row and Group into tab are disabled', () => {
    const { panels } = buildTestSceneWithPanelsInTwoRows();
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];

    const { elements } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    const [groupIntoRow, groupIntoTab] = elements.groupControlsDisabledFor(
      'Select items within the same row, tab, or grid to group them'
    );
    expect(groupIntoRow).toBeDisabled();
    expect(groupIntoTab).toBeDisabled();
  });

  test('when the user clicks Delete and confirms, every selected panel is removed', async () => {
    const { layoutManager, panels } = buildTestScene({ panelCount: 2 });
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { actions } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    await actions.clickDelete();

    const [event] = mockPublishAppEvent.mock.calls[0];
    expect(event).toBeInstanceOf(ShowConfirmModalEvent);
    expect(event.payload.title).toBe('Multiple panels');
    expect(layoutManager.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-1', 'panel-2']);

    event.payload.onConfirm();

    expect(layoutManager.getVizPanels().map((panel) => panel.state.key)).toEqual([]);
  });

  test('when the user clicks Delete and confirms, each removal is reported as coming from the edit popover', async () => {
    const { panels } = buildTestScene({ panelCount: 2 });
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { actions } = renderPanelEditActionsBulk({ panel: panels[0], selected });

    await actions.clickDelete();
    const [event] = mockPublishAppEvent.mock.calls[0];
    event.payload.onConfirm();

    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('delete', 1, 'edit_popover');
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('delete', 2, 'edit_popover');
  });
});

describe('<PanelEditActionsWrapper />', () => {
  function renderPanelEditActionsWrapper({
    panel,
    selected = [],
  }: {
    panel: VizPanel;
    selected?: ElementSelectionContextItem[];
  }) {
    const renderResult = render(
      <ElementSelectionContext.Provider value={{ enabled: true, selected, onSelect: jest.fn(), onClear: jest.fn() }}>
        <PanelEditActionsWrapper panel={panel}>
          <div data-testid="reference-child">panel</div>
        </PanelEditActionsWrapper>
      </ElementSelectionContext.Provider>
    );

    return {
      ...renderResult,
      elements: {
        referenceChild: () => renderResult.getByTestId('reference-child'),
        // One control unique to each content, to tell the two apart.
        editVisualization: () => renderResult.queryByRole('button', { name: 'Edit visualization' }),
        selectionLabel: (count: number) => renderResult.queryByText(`${count} panels selected`),
      },
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('when two panels are selected and the pointer rests on one of them, the bulk actions are shown', async () => {
    const { panels } = buildTestScene({ panelCount: 2 });
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { elements } = renderPanelEditActionsWrapper({ panel: panels[0], selected });

    await hoverAndRest(elements.referenceChild());

    expect(elements.selectionLabel(2)).toBeInTheDocument();
    expect(elements.editVisualization()).not.toBeInTheDocument();
  });

  test('when two panels are selected and the pointer rests on an unselected panel, the single panel actions are shown', async () => {
    const { panels } = buildTestScene({ panelCount: 3 });
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { elements } = renderPanelEditActionsWrapper({ panel: panels[2], selected });

    await hoverAndRest(elements.referenceChild());

    expect(elements.editVisualization()).toBeInTheDocument();
    expect(elements.selectionLabel(2)).not.toBeInTheDocument();
  });

  test('when the pointer rests on a repeat clone whose source panel is selected, the bulk actions are shown', async () => {
    const { clonedPanels } = buildTestSceneWithRepeatedPanels({
      cloneCountPerRepeat: 1,
      nonRepeatedPanelCount: 1,
    });
    const selected = [{ id: 'panel-1' }, { id: 'panel-2' }];
    const { elements } = renderPanelEditActionsWrapper({ panel: clonedPanels[0], selected });

    await hoverAndRest(elements.referenceChild());

    // The clone is selected through its source, which renders as two panels.
    expect(elements.selectionLabel(3)).toBeInTheDocument();
  });

  test('when a single panel is selected and the pointer rests on it, the single panel actions are shown', async () => {
    const { panels } = buildTestScene();
    const selected = [{ id: 'panel-1' }];
    const { elements } = renderPanelEditActionsWrapper({ panel: panels[0], selected });

    await hoverAndRest(elements.referenceChild());

    expect(elements.editVisualization()).toBeInTheDocument();
  });

  describe('when a layout provider supplies a portal root', () => {
    test('when the pointer rests, the floating content is in that element', async () => {
      const portalRoot = document.createElement('div');
      document.body.appendChild(portalRoot);

      const { panels } = buildTestScene();

      render(
        <EditActionsLayoutProvider containerRef={{ current: portalRoot }} isDocked={false} isHidden={false}>
          <ElementSelectionContext.Provider
            value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
          >
            <PanelEditActionsWrapper panel={panels[0]}>
              <div data-testid="reference-child">panel</div>
            </PanelEditActionsWrapper>
          </ElementSelectionContext.Provider>
        </EditActionsLayoutProvider>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(portalRoot).toContainElement(screen.getByRole('button', { name: 'Settings' }));

      portalRoot.remove();
    });
  });

  describe('when the dashboard is not in edit mode', () => {
    test('resting the pointer does not show the edit actions', async () => {
      const { panels } = buildTestScene({ isEditing: false });

      render(
        <ElementSelectionContext.Provider
          value={{ enabled: false, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panels[0]}>
            <div data-testid="reference-child">panel</div>
          </PanelEditActionsWrapper>
        </ElementSelectionContext.Provider>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    });
  });

  describe('when edit mode is toggled off and on again', () => {
    test('the child is not remounted, so its transient state is preserved', async () => {
      const { panels } = buildTestScene();
      const tree = (selectionEnabled: boolean) => (
        <ElementSelectionContext.Provider
          value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panels[0]}>
            <input data-testid="reference-child" />
          </PanelEditActionsWrapper>
        </ElementSelectionContext.Provider>
      );
      const { user, rerender } = render(tree(true));

      await user.type(screen.getByTestId('reference-child'), 'unsaved panel state');

      rerender(tree(false));
      rerender(tree(true));

      expect(screen.getByTestId('reference-child')).toHaveValue('unsaved panel state');
    });

    test('resting the pointer shows the edit actions again', async () => {
      const { panels } = buildTestScene();
      const tree = (selectionEnabled: boolean) => (
        <ElementSelectionContext.Provider
          value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panels[0]}>
            <div data-testid="reference-child">panel</div>
          </PanelEditActionsWrapper>
        </ElementSelectionContext.Provider>
      );
      const { rerender } = render(tree(true));

      rerender(tree(false));
      rerender(tree(true));
      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });
  });

  describe('when hover popover is not supported', () => {
    beforeEach(() => {
      mockUseHoverPopoverSupported.mockReturnValue(false);
    });
    afterEach(() => {
      mockUseHoverPopoverSupported.mockReturnValue(true);
    });

    test('when hover popover is not supported and the pointer rests, the floating content is not shown', async () => {
      const { panels } = buildTestScene();

      renderPanelEditActionsWrapper({ panel: panels[0] });

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit visualization' })).not.toBeInTheDocument();
    });
  });
});
