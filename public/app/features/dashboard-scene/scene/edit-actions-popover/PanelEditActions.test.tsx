import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { VizPanel } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { VizPanelEditableElement } from '../../sidebar/VizPanelEditableElement';
import { DashboardInteractions } from '../../utils/interactions';
import * as utils from '../../utils/utils';
import { type DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';

import { SHOW_COPIED_DURATION_MS } from './EditActions';
import { WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { PanelEditActions, PanelEditWrapper } from './PanelEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

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

function renderPanelEditActions() {
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

  test('renders settings, edit visualization, copy, duplicate, and delete controls', () => {
    renderPanelEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit visualization' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('renders Copy to clipboard before Duplicate', () => {
    renderPanelEditActions();

    const buttons = screen.getAllByRole('button');
    const copyIndex = buttons.findIndex((button) => button.getAttribute('aria-label') === 'Copy to clipboard');
    const duplicateIndex = buttons.findIndex((button) => button.getAttribute('aria-label') === 'Duplicate');

    expect(copyIndex).toBeGreaterThan(-1);
    expect(duplicateIndex).toBeGreaterThan(-1);
    expect(copyIndex).toBeLessThan(duplicateIndex);
  });

  describe('when the user clicks on Settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit, onClickDelete } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit visualization', () => {
    test('calls onClickEditVisualization', () => {
      const { onClickEdit, onClickEditVisualization } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

      expect(onClickEditVisualization).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
    });
  });

  describe('when the user hovers Copy to clipboard', () => {
    test('shows a Copy to clipboard tooltip', async () => {
      const { user } = renderPanelEditActions();

      await user.hover(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(screen.getByRole('tooltip')).toHaveTextContent('Copy to clipboard');
    });
  });

  describe('when the user clicks on Copy to clipboard', () => {
    test('calls onClickCopy', () => {
      const { onClickCopy, onClickDuplicate, onClickDelete } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(onClickCopy).toHaveBeenCalledTimes(1);
      expect(onClickDuplicate).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
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

    test('if the Copied tooltip has disappeared, then hovering shows Copy to clipboard', async () => {
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

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete } = renderPanelEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
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
});

describe('<PanelEditWrapper />', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPanelEditWrapper(panel: VizPanel) {
    return render(
      <ElementSelectionContext.Provider
        value={{ enabled: true, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
      >
        <PanelEditWrapper panel={panel}>
          <div data-testid="reference-child">panel</div>
        </PanelEditWrapper>
      </ElementSelectionContext.Provider>
    );
  }

  function buildRepeatClone() {
    const sourcePanel = new VizPanel({ title: 'Source', pluginId: 'timeseries', key: 'panel-1' });
    const clonePanel = sourcePanel.clone({ key: 'panel-1-clone-1', repeatSourceKey: sourcePanel.state.key });
    new DashboardGridItem({
      body: sourcePanel,
      repeatedPanels: [clonePanel],
    });
    return { sourcePanel, clonePanel };
  }

  function mockSidebarSelection() {
    const onSelect = jest.fn();
    const selectObject = jest.fn();

    jest.spyOn(utils, 'getDashboardSceneFor').mockReturnValue({
      state: {
        sidebar: {
          selectObject,
          state: {
            selectionContext: { onSelect },
          },
        },
      },
    } as unknown as DashboardScene);

    return { onSelect, selectObject };
  }

  test('if the user clicks Settings, then the panel is selected via selectionContext.onSelect with force true', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    const { onSelect, selectObject } = mockSidebarSelection();

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onSelect).toHaveBeenCalledWith({ id: 'panel-1' }, { force: true });
    expect(selectObject).not.toHaveBeenCalled();
  });

  describe('when the panel is a repeat clone', () => {
    test('if the user clicks Settings, then onSelect is called with the clone key', async () => {
      const { clonePanel } = buildRepeatClone();
      const { onSelect, selectObject } = mockSidebarSelection();

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onSelect).toHaveBeenCalledWith({ id: clonePanel.state.key }, { force: true });
      expect(selectObject).not.toHaveBeenCalled();
    });
    test('if the user clicks Edit visualization, then panel edit opens for the source panel', async () => {
      const { sourcePanel, clonePanel } = buildRepeatClone();
      const getPanelIdForVizPanel = jest.spyOn(utils, 'getPanelIdForVizPanel');
      jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

      expect(getPanelIdForVizPanel).toHaveBeenCalledWith(sourcePanel);
      expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('configure', 1, 'edit_popover');
    });

    test('if the user clicks Copy, then the source panel is copied', async () => {
      const { sourcePanel, clonePanel } = buildRepeatClone();
      let copiedPanel: VizPanel | undefined;
      jest.spyOn(VizPanelEditableElement.prototype, 'onCopy').mockImplementation(function (
        this: VizPanelEditableElement
      ) {
        copiedPanel = this.panel;
      });

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(copiedPanel).toBe(sourcePanel);
    });

    test('if the user clicks Duplicate, then the source panel is duplicated', async () => {
      const { sourcePanel, clonePanel } = buildRepeatClone();
      let duplicatedPanel: VizPanel | undefined;
      jest.spyOn(VizPanelEditableElement.prototype, 'onDuplicate').mockImplementation(function (
        this: VizPanelEditableElement
      ) {
        duplicatedPanel = this.panel;
      });

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(duplicatedPanel).toBe(sourcePanel);
    });

    test('if the user confirms Delete, then the source panel is deleted', async () => {
      const { sourcePanel, clonePanel } = buildRepeatClone();
      let deletedPanel: VizPanel | undefined;
      jest.spyOn(VizPanelEditableElement.prototype, 'onDelete').mockImplementation(function (
        this: VizPanelEditableElement
      ) {
        deletedPanel = this.panel;
      });

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      const [arg] = mockPublishAppEvent.mock.calls[0];
      arg.payload.onConfirm();

      expect(deletedPanel).toBe(sourcePanel);
    });

    test('if the source panel is missing, then clicking Copy throws', async () => {
      const clonePanel = new VizPanel({
        title: 'Clone',
        pluginId: 'timeseries',
        key: 'panel-1-clone-1',
        repeatSourceKey: 'panel-1',
      });
      const onCopy = jest.spyOn(VizPanelEditableElement.prototype, 'onCopy');
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      renderPanelEditWrapper(clonePanel);

      await hoverAndRest(screen.getByTestId('reference-child'));
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

      expect(onCopy).not.toHaveBeenCalled();
      expect(consoleError.mock.calls.flat()).toContainEqual(new Error('Unable to find scene with key panel-1'));
    });
  });
});
