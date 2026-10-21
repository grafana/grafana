import { type JSX, type ReactNode } from 'react';
import { act, createEvent, fireEvent, render, screen, userEvent, waitFor } from 'test/test-utils';

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

  describe('when showOutsideEditMode is set', () => {
    test('resting the pointer shows floating content while element selection is not enabled', async () => {
      render(
        <EditActionsPopover showOutsideEditMode content={<span>popover-actions</span>}>
          <div data-testid="reference-child">panel</div>
        </EditActionsPopover>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByText('popover-actions')).toBeInTheDocument();
    });
  });

  describe('when keepOpen is set', () => {
    test('unhovering the reference does not hide floating content', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const tree = (keepOpen: boolean) => (
        <EditActionsPopover showOutsideEditMode keepOpen={keepOpen} content={<span>popover-actions</span>}>
          <div data-testid="reference-child">panel</div>
        </EditActionsPopover>
      );
      const { rerender } = render(tree(false));

      await user.hover(screen.getByTestId('reference-child'));
      act(() => {
        jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
      });
      rerender(tree(true));
      await act(async () => {
        await user.unhover(screen.getByTestId('reference-child'));
      });

      expect(screen.getByText('popover-actions')).toBeInTheDocument();

      rerender(tree(false));

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });
  });

  describe('when keyboardAccessible is set', () => {
    function renderKeyboardAccessible() {
      return render(
        <>
          <button>before</button>
          <EditActionsPopover
            showOutsideEditMode
            keyboardAccessible
            ariaLabel="Panel actions"
            content={<button>action</button>}
          >
            <div data-testid="reference-child">
              <button>inside reference</button>
            </div>
          </EditActionsPopover>
        </>
      );
    }

    test('keyboard focus within the reference shows the content as a labelled toolbar', async () => {
      const { user } = renderKeyboardAccessible();

      await user.tab();
      await user.tab();

      expect(screen.getByRole('button', { name: 'inside reference' })).toHaveFocus();
      expect(screen.getByRole('toolbar', { name: 'Panel actions' })).toBeInTheDocument();
    });

    test('the content is next in the tab order after the reference', async () => {
      const { user } = renderKeyboardAccessible();

      await user.tab();
      await user.tab();
      await user.tab();

      expect(screen.getByRole('button', { name: 'action' })).toHaveFocus();
    });

    test('pressing Escape hides the content', async () => {
      const { user } = renderKeyboardAccessible();

      await user.tab();
      await user.tab();
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
    });

    test('pressing Escape on an action returns focus to the reference', async () => {
      const { user } = renderKeyboardAccessible();

      await user.tab();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: 'action' })).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('toolbar', { name: 'Panel actions' })).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'inside reference' })).toHaveFocus());
    });
  });

  describe('when openOnTap is set', () => {
    function renderOpenOnTap() {
      return render(
        <>
          <div data-testid="outside">outside</div>
          <EditActionsPopover showOutsideEditMode openOnTap content={<span>popover-actions</span>}>
            <div data-testid="reference-child">panel</div>
          </EditActionsPopover>
        </>
      );
    }

    // Browsers don't always send mouseenter for a tap, so this sends only the pointer events and click of a tap.
    function tap(element: HTMLElement) {
      fireEvent.pointerDown(element, { pointerType: 'touch' });
      fireEvent.pointerUp(element, { pointerType: 'touch' });
      fireEvent.click(element);
    }

    test('a touch tap on the reference shows the content, and a tap outside hides it', async () => {
      renderOpenOnTap();

      tap(screen.getByTestId('reference-child'));

      expect(await screen.findByText('popover-actions')).toBeInTheDocument();

      tap(screen.getByTestId('outside'));

      await waitFor(() => expect(screen.queryByText('popover-actions')).not.toBeInTheDocument());
    });

    test('the keyboard keeps working in controls inside the reference', async () => {
      const user = userEvent.setup();
      render(
        <EditActionsPopover showOutsideEditMode openOnTap content={<span>popover-actions</span>}>
          <div data-testid="reference-child">
            <input aria-label="filter" />
            <input type="checkbox" aria-label="show series" />
          </div>
        </EditActionsPopover>
      );

      await user.tab();
      await user.keyboard('a b{Enter}');

      expect(screen.getByRole('textbox', { name: 'filter' })).toHaveValue('a b');
      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

      await user.tab();
      await user.keyboard(' ');

      expect(screen.getByRole('checkbox', { name: 'show series' })).toBeChecked();
    });

    test('a mouse click on the reference does not show the content without the pointer resting', async () => {
      const { user } = renderOpenOnTap();

      await user.click(screen.getByTestId('reference-child'));

      expect(screen.getByText('panel')).toBeInTheDocument();
      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
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
