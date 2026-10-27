import { fireEvent, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';

import { FloatingWidthHandle } from './FloatingWidthHandle';
import {
  DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH,
  MAX_EXTENSION_SIDEBAR_WIDTH,
  MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH,
} from './constants';

// jsdom has no PointerEvent, so fireEvent would drop clientX and button from pointer events.
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

function renderHandle(width = 500) {
  const onWidthChange = jest.fn();
  render(
    <div data-testid="sidebar">
      <FloatingWidthHandle width={width} onWidthChange={onWidthChange} />
    </div>
  );
  // jsdom lays nothing out: the sidebar is as wide as the stored width.
  screen.getByTestId('sidebar').getBoundingClientRect = () => ({ width }) as DOMRect;
  return { handle: screen.getByRole('separator', { name: 'Resize sidebar width' }), onWidthChange };
}

describe('FloatingWidthHandle', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
  });

  it('is a focusable vertical separator reporting the width and its range', () => {
    const { handle } = renderHandle();
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).toHaveAttribute('aria-valuenow', '500');
    expect(handle).toHaveAttribute('aria-valuemin', String(MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH));
    expect(handle).toHaveAttribute('aria-valuemax', String(MAX_EXTENSION_SIDEBAR_WIDTH));
    // It resizes; it is not the handle the sidebar is moved by.
    expect(handle).not.toHaveAttribute('data-extension-floating-drag-handle');
  });

  it('widens when dragged left and narrows when dragged right, reporting the drag once it ends', () => {
    const { handle, onWidthChange } = renderHandle();

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250 });
    expect(onWidthChange).toHaveBeenLastCalledWith(550);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 320 });
    expect(onWidthChange).toHaveBeenLastCalledWith(480);
    expect(reportInteraction).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 320 });
    expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_resized', {
      method: 'drag',
      width: 480,
    });
  });

  it('keeps the width within its range', () => {
    const { handle, onWidthChange } = renderHandle();

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 2000 });
    expect(onWidthChange).toHaveBeenLastCalledWith(MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -5000 });
    expect(onWidthChange).toHaveBeenLastCalledWith(MAX_EXTENSION_SIDEBAR_WIDTH);
  });

  it('steps with the arrow keys, Shift for larger steps, and resets on Home or a double-click', () => {
    const { handle, onWidthChange } = renderHandle();

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onWidthChange).toHaveBeenLastCalledWith(516);
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(onWidthChange).toHaveBeenLastCalledWith(436);

    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onWidthChange).toHaveBeenLastCalledWith(DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
    onWidthChange.mockClear();
    fireEvent.doubleClick(handle);
    expect(onWidthChange).toHaveBeenCalledWith(DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
  });
});
