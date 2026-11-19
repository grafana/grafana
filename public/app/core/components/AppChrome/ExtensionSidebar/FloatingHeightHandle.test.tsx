import { act, fireEvent, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';

import { FLOATING_HEIGHT_VARIABLE, FloatingHeightHandle, releasedFloatingHeight } from './FloatingHeightHandle';
import { DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH, MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH } from './constants';
import {
  type FloatingExtensionSidebarHeightOptions,
  resetExtensionSidebarPresentationForTests,
  subscribeToFloatingExtensionSidebarCollapse,
} from './extensionSidebarLayout';
import { FLOATING_SNAP_DURATION_MS } from './useFloatingDrag';

// jsdom has no PointerEvent, so fireEvent would drop clientX, clientY and button from pointer events.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- enough of PointerEvent for these tests
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const OPTIONS: FloatingExtensionSidebarHeightOptions = { minHeight: 400, collapsedHeight: 100 };
// jsdom's window is 768px tall, so the sidebar is at most 720px.
const MAX_HEIGHT = 720;

function renderHandle({
  edge = 'top',
  options = OPTIONS,
  height,
  rendered = { width: 500, height: 500 },
}: {
  edge?: 'top' | 'corner';
  options?: FloatingExtensionSidebarHeightOptions;
  height?: number;
  rendered?: { width: number; height: number };
} = {}) {
  const onHeightChange = jest.fn();
  const onWidthChange = jest.fn();
  render(
    <div data-testid="sidebar">
      <FloatingHeightHandle
        edge={edge}
        options={options}
        height={height}
        onHeightChange={onHeightChange}
        onWidthChange={onWidthChange}
      />
    </div>
  );
  const sidebar = screen.getByTestId('sidebar');
  // jsdom lays nothing out: the sidebar is as large as the extension draws it.
  sidebar.getBoundingClientRect = () => ({ ...rendered }) as DOMRect;
  const handle =
    edge === 'top'
      ? screen.getByRole('separator', { name: 'Resize sidebar height' })
      : screen.getByTestId('extension-sidebar-floating-corner-handle');
  const variable = () => sidebar.style.getPropertyValue(FLOATING_HEIGHT_VARIABLE);
  return { handle, sidebar, variable, onHeightChange, onWidthChange };
}

function finishGlide() {
  act(() => {
    jest.advanceTimersByTime(FLOATING_SNAP_DURATION_MS + 50);
  });
}

describe('releasedFloatingHeight', () => {
  it('keeps a release within the bounds', () => {
    expect(releasedFloatingHeight(500, OPTIONS)).toBe(500);
    expect(releasedFloatingHeight(5000, OPTIONS)).toBe(MAX_HEIGHT);
  });

  it('returns to the minimum short of halfway to the collapsed height, and collapses past it', () => {
    expect(releasedFloatingHeight(300, OPTIONS)).toBe(400);
    expect(releasedFloatingHeight(249, OPTIONS)).toBe('collapse');
  });

  it('never collapses an extension without a collapsed height', () => {
    expect(releasedFloatingHeight(10, { minHeight: 400 })).toBe(400);
  });
});

describe('FloatingHeightHandle', () => {
  const collapse = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(reportInteraction).mockClear();
    collapse.mockClear();
    subscribeToFloatingExtensionSidebarCollapse(collapse);
  });

  afterEach(() => {
    jest.useRealTimers();
    resetExtensionSidebarPresentationForTests();
  });

  describe('on the top edge', () => {
    it('is a focusable horizontal separator reporting the height and its range', () => {
      const { handle } = renderHandle();
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
      expect(handle).toHaveAttribute('tabindex', '0');
      expect(handle).toHaveAttribute('aria-valuemin', '400');
      expect(handle).toHaveAttribute('aria-valuemax', String(MAX_HEIGHT));
      // It resizes; it is not the handle the sidebar is moved by.
      expect(handle).not.toHaveAttribute('data-extension-floating-drag-handle');
    });

    it('grows when dragged up, writing the height as it goes and committing it once the glide ends', () => {
      const { handle, variable, onHeightChange } = renderHandle();

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 200 });
      expect(variable()).toBe('600px');
      expect(onHeightChange).not.toHaveBeenCalled();

      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 200 });
      expect(onHeightChange).toHaveBeenCalledWith(600);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_resized', {
        edge: 'top',
        method: 'drag',
        height: 600,
      });
    });

    // Below halfway between the minimum and the collapsed height, a release would collapse it.
    it.each([500, 200])("leaves the extension's own height alone on a click, %spx tall", (rendered) => {
      const { handle, variable, onHeightChange } = renderHandle({ rendered: { width: 500, height: rendered } });

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 300 });
      finishGlide();
      expect(variable()).toBe('');
      expect(onHeightChange).not.toHaveBeenCalled();
      expect(collapse).not.toHaveBeenCalled();
      expect(reportInteraction).not.toHaveBeenCalled();
    });

    it('keeps the top edge below the page content top, so it never covers the top bar', () => {
      const page = document.createElement('div');
      page.id = 'pageContent';
      page.getBoundingClientRect = () => ({ top: 100, left: 0, width: 1024, height: 668 }) as DOMRect;
      document.body.appendChild(page);
      try {
        const { handle, variable, onHeightChange } = renderHandle({
          rendered: { width: 500, height: 500, bottom: 750 } as { width: number; height: number },
        });

        fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
        fireEvent.pointerMove(handle, { pointerId: 1, clientY: -2000 });
        // 750 at the bottom, less the content's top at 100 and the 8px gutter.
        expect(variable()).toBe('642px');
        fireEvent.pointerUp(handle, { pointerId: 1, clientY: -2000 });
        expect(onHeightChange).toHaveBeenCalledWith(642);
      } finally {
        page.remove();
      }
    });

    it('reports the most it can resize to as the room under the top bar, measured again on focus and window resize', () => {
      const page = document.createElement('div');
      page.id = 'pageContent';
      page.getBoundingClientRect = () => ({ top: 100, left: 0, width: 1024, height: 668 }) as DOMRect;
      document.body.appendChild(page);
      try {
        const rendered = { width: 500, height: 500, bottom: 750 };
        const { handle, sidebar } = renderHandle({ rendered });

        act(() => handle.focus());
        // 750 at the bottom, less the content's top at 100 and the 8px gutter.
        expect(handle).toHaveAttribute('aria-valuemax', '642');

        // Lower in a shorter window.
        sidebar.getBoundingClientRect = () => ({ ...rendered, bottom: 650 }) as DOMRect;
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(handle).toHaveAttribute('aria-valuemax', '542');

        // Never below the minimum.
        sidebar.getBoundingClientRect = () => ({ ...rendered, bottom: 300 }) as DOMRect;
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(handle).toHaveAttribute('aria-valuemax', '400');
      } finally {
        page.remove();
      }
    });

    it('keeps the remembered height when a drag or a key leaves the height where it was, at the top bar', () => {
      const page = document.createElement('div');
      page.id = 'pageContent';
      page.getBoundingClientRect = () => ({ top: 100, left: 0, width: 1024, height: 668 }) as DOMRect;
      document.body.appendChild(page);
      try {
        // Shown at the 600px room under the top bar: 708 at the bottom, less the content's top at 100 and the gutter.
        const { handle, variable, onHeightChange } = renderHandle({
          height: 600,
          rendered: { width: 500, height: 600, bottom: 708 } as { width: number; height: number },
        });

        fireEvent.keyDown(handle, { key: 'ArrowUp' });
        fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
        fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
        fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 });
        finishGlide();
        expect(variable()).toBe('600px');
        expect(onHeightChange).not.toHaveBeenCalled();
        expect(reportInteraction).not.toHaveBeenCalled();
      } finally {
        page.remove();
      }
    });

    it('keeps the height under the window', () => {
      const { handle, variable, onHeightChange } = renderHandle();

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: -2000 });
      expect(variable()).toBe(`${MAX_HEIGHT}px`);
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: -2000 });
      expect(onHeightChange).toHaveBeenCalledWith(MAX_HEIGHT);
    });

    it('follows below the minimum and glides back to it when let go short of collapsing', () => {
      const { handle, variable, onHeightChange } = renderHandle();

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 500 });
      expect(variable()).toBe('300px');

      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 500 });
      expect(onHeightChange).not.toHaveBeenCalled();
      finishGlide();
      expect(variable()).toBe('400px');
      expect(onHeightChange).toHaveBeenCalledWith(400);
      expect(collapse).not.toHaveBeenCalled();
    });

    it('glides down and asks the extension to collapse when let go past halfway, keeping the committed height', () => {
      const { handle, variable, onHeightChange } = renderHandle({ height: 500 });

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 700 });
      // It follows no lower than the collapsed height.
      expect(variable()).toBe('100px');

      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 700 });
      finishGlide();
      expect(collapse).toHaveBeenCalledTimes(1);
      expect(collapse).toHaveBeenCalledWith({ method: 'resize', input: 'pointer' });
      expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_collapsed', {
        method: 'resize',
      });
      expect(onHeightChange).not.toHaveBeenCalled();
      // Back to the committed height for the next time the extension expands.
      expect(variable()).toBe('500px');
    });

    it('offers no collapse while nothing listens for one, stopping at the minimum', () => {
      resetExtensionSidebarPresentationForTests();
      const { handle, variable, onHeightChange } = renderHandle();

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 700 });
      expect(variable()).toBe('400px');
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 700 });
      finishGlide();
      expect(onHeightChange).toHaveBeenCalledWith(400);
      expect(reportInteraction).not.toHaveBeenCalledWith(
        'grafana_extension_sidebar_floating_collapsed',
        expect.anything()
      );

      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      expect(collapse).not.toHaveBeenCalled();
    });

    it('stops at the minimum for an extension without a collapsed height', () => {
      const { handle, variable, onHeightChange } = renderHandle({ options: { minHeight: 400 } });

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 900 });
      expect(variable()).toBe('400px');
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 900 });
      expect(onHeightChange).toHaveBeenCalledWith(400);
      expect(collapse).not.toHaveBeenCalled();
    });

    it('finishes a glide when pressed again', () => {
      const { handle, onHeightChange } = renderHandle();

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 300 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 450 });
      expect(onHeightChange).not.toHaveBeenCalled();

      fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientY: 300 });
      expect(onHeightChange).toHaveBeenCalledWith(400);
    });

    it('steps with the arrow keys, Shift for larger steps, collapses with Down at the minimum, and resets on Home', () => {
      const { handle, onHeightChange } = renderHandle({ height: 500 });

      fireEvent.keyDown(handle, { key: 'ArrowUp' });
      expect(onHeightChange).toHaveBeenLastCalledWith(516);
      fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
      expect(onHeightChange).toHaveBeenLastCalledWith(436);
      expect(reportInteraction).toHaveBeenLastCalledWith('grafana_extension_sidebar_floating_resized', {
        edge: 'top',
        method: 'keyboard',
        height: 436,
      });

      fireEvent.keyDown(handle, { key: 'Home' });
      expect(onHeightChange).toHaveBeenLastCalledWith(undefined);
      expect(collapse).not.toHaveBeenCalled();
    });

    it('collapses with Down at the minimum', () => {
      const { handle, onHeightChange } = renderHandle({ height: 400 });

      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      expect(collapse).toHaveBeenCalledTimes(1);
      // The extension can move focus, since the handle goes with the conversation.
      expect(collapse).toHaveBeenCalledWith({ method: 'resize', input: 'keyboard' });
      expect(onHeightChange).not.toHaveBeenCalled();
    });

    it("goes back to the extension's own height on a double-click", () => {
      const { handle, onHeightChange, onWidthChange } = renderHandle({ height: 500 });

      fireEvent.doubleClick(handle);
      expect(onHeightChange).toHaveBeenCalledWith(undefined);
      expect(onWidthChange).not.toHaveBeenCalled();
    });
  });

  describe('on the top-left corner', () => {
    it('is a pointer shortcut, hidden from assistive technology', () => {
      const { handle } = renderHandle({ edge: 'corner' });
      expect(handle).toHaveAttribute('aria-hidden', 'true');
      expect(handle).not.toHaveAttribute('tabindex');
    });

    it('resizes the width and the height with one drag, reporting both', () => {
      const { handle, variable, onHeightChange, onWidthChange } = renderHandle({ edge: 'corner' });

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 220 });
      expect(onWidthChange).toHaveBeenLastCalledWith(550);
      expect(variable()).toBe('580px');
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: -5000, clientY: 220 });
      expect(onWidthChange).toHaveBeenLastCalledWith(MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH);

      fireEvent.pointerUp(handle, { pointerId: 1, clientX: -5000, clientY: 220 });
      expect(onHeightChange).toHaveBeenCalledWith(580);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_resized', {
        edge: 'corner',
        method: 'drag',
        width: MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH,
        height: 580,
      });
    });

    it('changes only the width when dragged sideways, leaving the height to the extension', () => {
      const { handle, variable, onHeightChange, onWidthChange } = renderHandle({ edge: 'corner' });

      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 300 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 250, clientY: 300 });
      finishGlide();
      expect(onWidthChange).toHaveBeenLastCalledWith(550);
      expect(variable()).toBe('');
      expect(onHeightChange).not.toHaveBeenCalled();
      expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_resized', {
        edge: 'corner',
        method: 'drag',
        width: 550,
      });
    });

    it('resets both the width and the height on a double-click', () => {
      const { handle, onHeightChange, onWidthChange } = renderHandle({ edge: 'corner', height: 500 });

      fireEvent.doubleClick(handle);
      expect(onHeightChange).toHaveBeenCalledWith(undefined);
      expect(onWidthChange).toHaveBeenCalledWith(DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
    });
  });
});
