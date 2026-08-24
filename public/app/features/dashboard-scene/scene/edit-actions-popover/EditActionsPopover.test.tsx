import { act, createEvent, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { LazyLoader } from '@grafana/scenes';

import { EditActionsLayoutProvider } from './EditActionsLayoutContext';
import { EditActionsPopover, WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));

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

describe('<EditActionsPopover />', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('when isEditable is false', () => {
    test('renders children and does not show floating content on hover', async () => {
      render(
        <EditActionsPopover isEditable={false} content={<span>popover-actions</span>}>
          <div data-testid="reference-child">variable control</div>
        </EditActionsPopover>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByTestId('reference-child')).toHaveTextContent('variable control');
      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });
  });

  describe('when isEditable is true', () => {
    describe('when the user hovers the reference', () => {
      test('if the pointer is not at rest, then floating content is not shown', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        await user.hover(screen.getByTestId('reference-child'));

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
      });

      test('if the pointer rests, then floating content is shown in the document', async () => {
        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

        await hoverAndRest(screen.getByTestId('reference-child'));

        expect(screen.getByText('popover-actions')).toBeInTheDocument();
      });

      test('if the reference is a LazyLoader and the pointer rests, then floating content is shown in the document', async () => {
        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <LazyLoader key="panel-1" mode="query" data-testid="reference-child">
              panel
            </LazyLoader>
          </EditActionsPopover>
        );

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

        await hoverAndRest(screen.getByTestId('reference-child'));

        expect(screen.getByText('popover-actions')).toBeInTheDocument();
      });

      test('if the user then unhovers, then floating content is hidden', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        const referenceChild = screen.getByTestId('reference-child');

        await user.hover(referenceChild);
        act(() => {
          jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
        });

        expect(screen.getByText('popover-actions')).toBeInTheDocument();

        await act(async () => {
          await user.unhover(referenceChild);
        });

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
      });
    });

    test('pointerdown stops event propagation', async () => {
      render(
        <EditActionsPopover isEditable={true} content={<button>action</button>}>
          <div data-testid="reference-child">control</div>
        </EditActionsPopover>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      const actionButton = screen.getByRole('button', { name: 'action' });
      const pointerDownEvent = createEvent.pointerDown(actionButton);
      const stopPropagation = jest.spyOn(pointerDownEvent, 'stopPropagation');

      fireEvent(actionButton, pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    test('when a layout provider supplies a portal root and the pointer rests, floating content is in that root', async () => {
      const portalRoot = document.createElement('div');
      const { container } = render(
        <EditActionsLayoutProvider canvasRef={{ current: portalRoot }} isDocked={false} isHidden={false}>
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        </EditActionsLayoutProvider>
      );
      container.appendChild(portalRoot);

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(portalRoot).toContainElement(screen.getByText('popover-actions'));
    });
  });
});
