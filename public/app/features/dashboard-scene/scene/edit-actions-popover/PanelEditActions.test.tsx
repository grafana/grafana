import { act, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { VizPanel } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { VizPanelEditableElement } from '../../sidebar/VizPanelEditableElement';
import { DashboardInteractions } from '../../utils/interactions';
import * as utils from '../../utils/utils';
import { type DashboardScene } from '../DashboardScene';

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

  test('if the user clicks Settings, then the panel is selected via selectionContext.onSelect so repeated clones remap to the source panel', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'test-panel' });
    const { onSelect, selectObject } = mockSidebarSelection();

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onSelect).toHaveBeenCalledWith({ id: 'test-panel' }, { force: true });
    expect(selectObject).not.toHaveBeenCalled();
  });

  test('if the user clicks Edit visualization, then panelActionClicked is called', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    const getPanelIdForVizPanel = jest.spyOn(utils, 'getPanelIdForVizPanel');
    jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

    expect(getPanelIdForVizPanel).toHaveBeenCalledWith(panel);
    expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('configure', 1, 'edit_popover');
  });

  test('if the user clicks Copy, then VizPanelEditableElement.onCopy is called', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    let copiedPanel: VizPanel | undefined;
    const onCopy = jest.spyOn(VizPanelEditableElement.prototype, 'onCopy').mockImplementation(function (
      this: VizPanelEditableElement
    ) {
      copiedPanel = this.panel;
    });

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    expect(copiedPanel).toBe(panel);
    expect(onCopy).toHaveBeenCalledWith('edit_popover');
  });

  test('if the user clicks Duplicate, then VizPanelEditableElement.onDuplicate is called', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    let duplicatedPanel: VizPanel | undefined;
    const onDuplicate = jest.spyOn(VizPanelEditableElement.prototype, 'onDuplicate').mockImplementation(function (
      this: VizPanelEditableElement
    ) {
      duplicatedPanel = this.panel;
    });

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(duplicatedPanel).toBe(panel);
    expect(onDuplicate).toHaveBeenCalledWith('edit_popover');
  });

  test('if the user confirms Delete, then VizPanelEditableElement.onDelete is called', async () => {
    const panel = new VizPanel({ title: 'Test panel', pluginId: 'timeseries', key: 'panel-1' });
    let deletedPanel: VizPanel | undefined;
    const onDelete = jest.spyOn(VizPanelEditableElement.prototype, 'onDelete').mockImplementation(function (
      this: VizPanelEditableElement
    ) {
      deletedPanel = this.panel;
    });

    renderPanelEditWrapper(panel);

    await hoverAndRest(screen.getByTestId('reference-child'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const [arg] = mockPublishAppEvent.mock.calls[0];
    arg.payload.onConfirm();

    expect(deletedPanel).toBe(panel);
    expect(onDelete).toHaveBeenCalledWith('edit_popover');
  });
});
