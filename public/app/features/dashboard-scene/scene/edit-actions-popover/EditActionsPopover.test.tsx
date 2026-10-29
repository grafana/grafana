import { type JSX, type ReactNode } from 'react';
import { act, createEvent, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { LazyLoader } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';

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

function renderEditActionsPopover({
  disabled = false,
  selectionEnabled = true,
  content = <span>popover-actions</span>,
  children = <div data-testid="reference-child">variable control</div>,
  portalRoot,
}: {
  disabled?: boolean;
  selectionEnabled?: boolean;
  content?: ReactNode;
  children?: JSX.Element;
  portalRoot?: () => HTMLElement | undefined;
} = {}) {
  const renderResult = render(
    <ElementSelectionContext.Provider
      value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
    >
      <EditActionsPopover disabled={disabled} content={content} portalRoot={portalRoot}>
        {children}
      </EditActionsPopover>
    </ElementSelectionContext.Provider>
  );

  return {
    ...renderResult,
    elements: {
      children: () => renderResult.getByTestId('reference-child'),
      getPopoverContent: () => renderResult.getByText('popover-actions'),
      queryPopoverContent: () => renderResult.queryByText('popover-actions'),
      actionButton: () => renderResult.getByRole('button', { name: 'action' }),
    },
  };
}

describe('<EditActionsPopover />', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('when element selection is enabled', () => {
    describe('when the user hovers the reference', () => {
      test('if the pointer is not at rest, then floating content is not shown', async () => {
        const user = userEvent.setup();

        const { elements } = renderEditActionsPopover();

        await user.hover(elements.children());

        expect(elements.queryPopoverContent()).not.toBeInTheDocument();
      });

      test('if the pointer rests, then floating content is shown in the document', async () => {
        const { elements } = renderEditActionsPopover();

        expect(elements.queryPopoverContent()).not.toBeInTheDocument();

        await hoverAndRest(elements.children());

        expect(elements.getPopoverContent()).toBeInTheDocument();
      });

      test('if the reference is a LazyLoader and the pointer rests, then floating content is shown in the document', async () => {
        const { elements } = renderEditActionsPopover({
          children: (
            <LazyLoader key="panel-1" mode="query" data-testid="reference-child">
              panel
            </LazyLoader>
          ),
        });

        expect(elements.queryPopoverContent()).not.toBeInTheDocument();

        await hoverAndRest(elements.children());

        expect(elements.getPopoverContent()).toBeInTheDocument();
      });

      test('if the user then unhovers, then floating content is hidden', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        const { elements } = renderEditActionsPopover();
        const referenceChild = elements.children();

        await user.hover(referenceChild);
        act(() => {
          jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
        });

        expect(elements.getPopoverContent()).toBeInTheDocument();

        await act(async () => {
          await user.unhover(referenceChild);
        });

        expect(elements.queryPopoverContent()).not.toBeInTheDocument();
      });
    });

    test('pointerdown stops event propagation', async () => {
      const { elements } = renderEditActionsPopover({ content: <button>action</button> });

      await hoverAndRest(elements.children());

      const actionButton = elements.actionButton();
      const pointerDownEvent = createEvent.pointerDown(actionButton);
      const stopPropagation = jest.spyOn(pointerDownEvent, 'stopPropagation');

      fireEvent(actionButton, pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    describe('when portalRoot is set', () => {
      test('when the pointer rests, floating content is in that root', async () => {
        const portalRoot = document.createElement('div');
        document.body.appendChild(portalRoot);

        const { elements } = renderEditActionsPopover({ portalRoot: () => portalRoot });

        await hoverAndRest(elements.children());

        expect(portalRoot).toContainElement(elements.getPopoverContent());

        portalRoot.remove();
      });
    });

    describe('when disabled', () => {
      test('resting the pointer does not show floating content', async () => {
        const { elements } = renderEditActionsPopover({ disabled: true });

        await hoverAndRest(elements.children());

        expect(elements.queryPopoverContent()).not.toBeInTheDocument();
      });
    });
  });

  describe('when element selection is not enabled', () => {
    test('resting the pointer does not show floating content', async () => {
      const { elements } = renderEditActionsPopover({ selectionEnabled: false });

      await hoverAndRest(elements.children());

      expect(elements.queryPopoverContent()).not.toBeInTheDocument();
    });
  });

  describe('when element selection is toggled off and on', () => {
    test('the child is not remounted, so its transient state is preserved', async () => {
      const tree = (selectionEnabled: boolean) => (
        <ElementSelectionContext.Provider
          value={{ enabled: selectionEnabled, selected: [], onSelect: jest.fn(), onClear: jest.fn() }}
        >
          <EditActionsPopover content={<span>popover-actions</span>}>
            <input data-testid="reference-child-input" />
          </EditActionsPopover>
        </ElementSelectionContext.Provider>
      );
      const { user, rerender } = render(tree(true));

      await user.type(screen.getByTestId('reference-child-input'), 'unsaved control state');

      rerender(tree(false));
      rerender(tree(true));

      expect(screen.getByTestId('reference-child-input')).toHaveValue('unsaved control state');
    });
  });
});
