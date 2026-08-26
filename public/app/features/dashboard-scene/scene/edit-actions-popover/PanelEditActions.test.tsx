import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { getCloneKey } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { SHOW_COPIED_DURATION_MS } from './EditActions';
import { EditActionsLayoutProvider } from './EditActionsLayoutContext';
import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { PanelEditActions, PanelEditActionsWrapper } from './PanelEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
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

function renderPanelEditActions({ isRepeated = false }: { isRepeated?: boolean } = {}) {
  const onClickEdit = jest.fn();
  const onClickEditVisualization = jest.fn();
  const onClickCopy = jest.fn();
  const onClickDuplicate = jest.fn();
  const onClickDelete = jest.fn();

  const renderResult = render(
    <PanelEditActions
      onClickEdit={onClickEdit}
      onClickEditVisualization={onClickEditVisualization}
      onClickCopy={onClickCopy}
      onClickDuplicate={onClickDuplicate}
      onClickDelete={onClickDelete}
      isRepeated={isRepeated}
    />
  );

  return {
    ...renderResult,
    onClickEdit,
    onClickEditVisualization,
    onClickCopy,
    onClickDuplicate,
    onClickDelete,
  };
}

describe('<PanelEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('renders Settings, Edit visualization, Copy, Duplicate, and Delete controls', () => {
    renderPanelEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit visualization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user clicks on Edit visualization', () => {
    test('calls onClickEditVisualization', () => {
      const { onClickEditVisualization } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

      expect(onClickEditVisualization).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy to clipboard', () => {
    describe('when the user hovers over the control', () => {
      test('shows a Copy to clipboard tooltip', async () => {
        const { user } = renderPanelEditActions();

        await user.hover(screen.getByRole('button', { name: 'Copy to clipboard' }));

        expect(screen.getByRole('tooltip')).toHaveTextContent('Copy to clipboard');
      });
    });

    describe('when the user clicks on the control', () => {
      test('calls onClickCopy', () => {
        const { onClickCopy } = renderPanelEditActions();

        fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

        expect(onClickCopy).toHaveBeenCalledTimes(1);
      });

      test('shows a Copied tooltip that disappears after 2 seconds', () => {
        jest.useFakeTimers();
        renderPanelEditActions();

        fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

        expect(screen.getByRole('tooltip')).toHaveTextContent('Copied');

        act(() => {
          jest.advanceTimersByTime(SHOW_COPIED_DURATION_MS);
        });

        expect(screen.queryByText('Copied')).not.toBeInTheDocument();
      });

      test('if the Copied tooltip has disappeared, then hovering again over the control shows a Copy to clipboard tooltip', async () => {
        jest.useFakeTimers();
        const { user } = renderPanelEditActions();

        fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

        act(() => {
          jest.advanceTimersByTime(SHOW_COPIED_DURATION_MS);
        });
        jest.useRealTimers();

        await user.hover(screen.getByRole('button', { name: 'Copy to clipboard' }));

        expect(screen.getByRole('tooltip')).toHaveTextContent('Copy to clipboard');
      });
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickDuplicate } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const { onClickDelete } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete panel?',
            text: expect.stringContaining('Deleting this panel will also remove all queries'),
            yesText: 'Delete',
            onConfirm: onClickDelete,
          },
        })
      );
    });
  });

  describe('when isRepeated is true', () => {
    test('disables Copy, Duplicate, and Delete controls ; keeps Settings and Edit visualization enabled', () => {
      renderPanelEditActions({ isRepeated: true });

      expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Edit visualization' })).toBeEnabled();
      expect(screen.getByRole('button', { name: "Repeated panels can't be copied individually" })).toBeDisabled();
      expect(screen.getByRole('button', { name: "Repeated panels can't be duplicated individually" })).toBeDisabled();
      expect(screen.getByRole('button', { name: "Repeated panels can't be deleted individually" })).toBeDisabled();
    });
  });
});

describe('<PanelEditActionsWrapper />', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPanelEditActionsWrapper(panel: VizPanel) {
    return render(
      <ElementSelectionContext.Provider
        value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
      >
        <PanelEditActionsWrapper panel={panel}>
          <div data-testid="reference-child">panel</div>
        </PanelEditActionsWrapper>
      </ElementSelectionContext.Provider>
    );
  }

  describe('when the user clicks Settings ', () => {
    test('the panel is selected via the sidebar', async () => {
      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'test-panel' });
      const scene = new DashboardScene({
        isEditing: true,
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      renderPanelEditActionsWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(scene.state.sidebar.getSelectedObject()).toBe(panel);
    });

    test('the source panel is always selected in case of repeated panels', async () => {
      const sourcePanel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'test-panel' });
      const clonedPanel = new VizPanel({
        title: 'Test panel',
        pluginId: 'timeseries',
        key: getCloneKey('test-panel', 1),
        repeatSourceKey: 'test-panel',
      });
      const scene = new DashboardScene({
        isEditing: true,
        body: DefaultGridLayoutManager.fromGridItems([
          new DashboardGridItem({ body: sourcePanel, repeatedPanels: [clonedPanel] }),
        ]),
      });

      renderPanelEditActionsWrapper(clonedPanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(scene.state.sidebar.getSelectedObject()).toBe(sourcePanel);
    });
  });

  test('if the user clicks Edit visualization, the panel editor is opened', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    new DashboardScene({
      isEditing: true,
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    });
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

    renderPanelEditActionsWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

    expect(mockLocationServicePartial).toHaveBeenCalledWith({ editPanel: getPanelIdForVizPanel(panel) });
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith(
      'configure',
      getPanelIdForVizPanel(panel),
      'edit_popover'
    );
  });

  test('if the user clicks Copy, the panel is copied via the dashboard', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    const scene = new DashboardScene({
      isEditing: true,
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    });

    const copyPanel = jest.spyOn(scene, 'copyPanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

    renderPanelEditActionsWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    expect(copyPanel).toHaveBeenCalledWith(panel);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith(
      'copy',
      getPanelIdForVizPanel(panel),
      'edit_popover'
    );
  });

  test('if the user clicks Duplicate, the panel is duplicated via its layout manager', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    const layoutManager = DefaultGridLayoutManager.fromVizPanels([panel]);
    new DashboardScene({
      isEditing: true,
      body: layoutManager,
    });
    const duplicatePanel = jest.spyOn(layoutManager, 'duplicatePanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

    renderPanelEditActionsWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(duplicatePanel).toHaveBeenCalledWith(panel);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('duplicate', 1, 'edit_popover');
  });

  test('if the user clicks & confirms Delete, the panel is removed via its layout manager', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    const layoutManager = DefaultGridLayoutManager.fromVizPanels([panel]);
    new DashboardScene({
      isEditing: true,
      body: layoutManager,
    });
    const removePanel = jest.spyOn(layoutManager, 'removePanel').mockImplementation();
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

    renderPanelEditActionsWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(removePanel).not.toHaveBeenCalled();

    const [event] = mockPublishAppEvent.mock.calls[0];
    event.payload.onConfirm();

    expect(removePanel).toHaveBeenCalledWith(panel);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('delete', 1, 'edit_popover');
  });

  describe('when a layout provider supplies a portal root', () => {
    test('when the pointer rests, the floating content is in that element', async () => {
      const portalRoot = document.createElement('div');
      document.body.appendChild(portalRoot);

      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
      new DashboardScene({
        isEditing: true,
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      render(
        <EditActionsLayoutProvider containerRef={{ current: portalRoot }} isDocked={false} isHidden={false}>
          <ElementSelectionContext.Provider
            value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
          >
            <PanelEditActionsWrapper panel={panel}>
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
      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });

      render(
        <ElementSelectionContext.Provider
          value={{ enabled: false, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panel}>
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
      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
      const tree = (selectionEnabled: boolean) => (
        <ElementSelectionContext.Provider
          value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panel}>
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
      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
      const tree = (selectionEnabled: boolean) => (
        <ElementSelectionContext.Provider
          value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <PanelEditActionsWrapper panel={panel}>
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
      const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });

      renderPanelEditActionsWrapper(panel);

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit visualization' })).not.toBeInTheDocument();
    });
  });
});
