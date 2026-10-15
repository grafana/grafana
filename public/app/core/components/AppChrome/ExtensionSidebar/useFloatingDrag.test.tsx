import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { FLOATING_DRAG_HANDLE_ATTRIBUTE, FLOATING_SNAP_DURATION_MS, useFloatingDrag } from './useFloatingDrag';

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

/** The floating box at rest at the bottom centre of a 1024x768 viewport, 24px from the bottom. */
let natural = { left: 312, top: 500, width: 400, height: 244 };
/** How far the handle sticks out past the box's left edge (0: inside the box). */
let handleOutset = 0;
const onHandleClick = jest.fn();

function Floating() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useFloatingDrag(element);
  return (
    <div ref={setElement} data-testid="floating">
      <button type="button" {...{ [FLOATING_DRAG_HANDLE_ATTRIBUTE]: '' }} onClick={onHandleClick}>
        Move
      </button>
    </div>
  );
}

beforeEach(() => {
  natural = { left: 312, top: 500, width: 400, height: 244 };
  handleOutset = 0;
  onHandleClick.mockClear();
  window.localStorage.clear();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id === 'pageContent') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured box without toJSON
      return { left: 0, top: 0, width: 1024, height: 768, right: 1024, bottom: 768, x: 0, y: 0 } as DOMRect;
    }
    // Reports the translated box, like a browser would.
    const box = this.closest('[data-testid="floating"]') ?? this;
    const match = /translate\((-?\d+)px, (-?\d+)px\)/.exec(box instanceof HTMLElement ? box.style.transform : '');
    const [x, y] = match ? [Number(match[1]), Number(match[2])] : [0, 0];
    if (handleOutset && this.hasAttribute(FLOATING_DRAG_HANDLE_ATTRIBUTE)) {
      const left = natural.left - handleOutset + x;
      const top = natural.top + y;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured box without toJSON
      return { left, top, width: handleOutset, height: 40, right: left + handleOutset, bottom: top + 40 } as DOMRect;
    }
    const left = natural.left + x;
    const top = natural.top + y;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured box without toJSON
    return {
      ...natural,
      left,
      top,
      right: left + natural.width,
      bottom: top + natural.height,
      x: left,
      y: top,
    } as DOMRect;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  document.getElementById('pageContent')?.remove();
});

const handle = () => screen.getByRole('button', { name: 'Move' });
const floating = () => screen.getByTestId('floating');

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(handle(), { clientX: from.x, clientY: from.y, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(handle(), { clientX: to.x, clientY: to.y });
  fireEvent.click(handle());
}

it('follows the pointer while dragging, kept inside the page with a gutter', () => {
  render(<Floating />);

  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: 300, clientY: 320 });
  expect(floating().style.transform).toBe('translate(-200px, -200px)');
  expect(floating()).toHaveAttribute('data-dragging');

  fireEvent.pointerMove(handle(), { clientX: -2000, clientY: -2000 });
  // Left edge at 8 (312 - 304) and top edge at 8 (500 - 492).
  expect(floating().style.transform).toBe('translate(-304px, -492px)');

  // Past the default place, down to the 8px gutter (the default sits 24px in).
  fireEvent.pointerMove(handle(), { clientX: 5000, clientY: 5000 });
  expect(floating().style.transform).toBe('translate(304px, 16px)');
});

// The anchors keep the default's 24px inset: left edge 24 (x -288), right edge 1000 (x 288), top edge 24 (y -476).
it.each([
  ['top left', { x: -250, y: -400 }, 'translate(-288px, -476px)'],
  ['top centre', { x: 30, y: -400 }, 'translate(0px, -476px)'],
  ['top right', { x: 250, y: -400 }, 'translate(288px, -476px)'],
  ['bottom left', { x: -250, y: -50 }, 'translate(-288px, 0px)'],
  ['bottom right', { x: 250, y: -50 }, 'translate(288px, 0px)'],
])('snaps on release to the nearest snap point: %s', (_, by, transform) => {
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 500 + by.x, y: 520 + by.y });

  expect(floating().style.transform).toBe(transform);
  // The handle's click does not fire after a move.
  expect(onHandleClick).not.toHaveBeenCalled();
});

it('snaps back to the default place at the bottom centre', () => {
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 540, y: 460 });

  expect(floating().style.transform).toBe('');
  expect(onHandleClick).not.toHaveBeenCalled();
});

it('marks the glide to the snap point, and only that', () => {
  jest.useFakeTimers();
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 250, y: 120 });
  expect(floating()).not.toHaveAttribute('data-dragging');
  expect(floating()).toHaveAttribute('data-snapping');

  act(() => {
    jest.advanceTimersByTime(FLOATING_SNAP_DURATION_MS);
  });
  expect(floating()).not.toHaveAttribute('data-snapping');

  // The arrow keys move in steps, without snapping or gliding.
  fireEvent.keyDown(handle(), { key: 'ArrowRight' });
  expect(floating().style.transform).toBe('translate(-272px, -476px)');
  expect(floating()).not.toHaveAttribute('data-snapping');
  jest.useRealTimers();
});

it('keeps a handle that sits outside the box on the page too, and snaps by it', () => {
  handleOutset = 28;
  render(<Floating />);
  expect(floating().style.transform).toBe('');

  fireEvent.pointerDown(handle(), { clientX: 302, clientY: 520, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: -2000, clientY: 520 });
  // The flag's left edge (312 - 28 - 276 = 8) stops at the gutter, not the box's.
  expect(floating().style.transform).toBe('translate(-276px, 0px)');

  fireEvent.pointerUp(handle(), { clientX: -2000, clientY: 520 });
  // The bottom-left point puts the flag's edge 24px in (312 - 28 - 260 = 24).
  expect(floating().style.transform).toBe('translate(-260px, 0px)');
});

it('keeps off the docked menu, which the page content reserves as padding', () => {
  const pageContent = document.createElement('div');
  pageContent.id = 'pageContent';
  pageContent.style.paddingLeft = '100px';
  document.body.appendChild(pageContent);
  render(<Floating />);

  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: -2000, clientY: 520 });
  // Left edge at 108: the menu's 100px plus the gutter.
  expect(floating().style.transform).toBe('translate(-204px, 0px)');

  fireEvent.pointerUp(handle(), { clientX: -2000, clientY: 520 });
  // The bottom-left point is 24px past the menu, at 124.
  expect(floating().style.transform).toBe('translate(-188px, 0px)');
});

it('treats a press that moves less than 4px as a click on the handle', () => {
  render(<Floating />);
  drag({ x: 500, y: 520 }, { x: 502, y: 523 });
  expect(floating().style.transform).toBe('');
  expect(onHandleClick).toHaveBeenCalledTimes(1);
});

it('moves with the arrow keys and resets with Home or a double-click', () => {
  render(<Floating />);
  handle().focus();

  fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
  expect(floating().style.transform).toBe('translate(-16px, 0px)');
  fireEvent.keyDown(handle(), { key: 'ArrowUp', shiftKey: true });
  expect(floating().style.transform).toBe('translate(-16px, -64px)');
  fireEvent.keyDown(handle(), { key: 'Home' });
  expect(floating().style.transform).toBe('');

  fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
  fireEvent.doubleClick(handle());
  expect(floating().style.transform).toBe('');
});

it('remembers the position: floating again starts where it was left', () => {
  const { unmount } = render(<Floating />);
  drag({ x: 500, y: 520 }, { x: 200, y: 420 });
  expect(floating().style.transform).toBe('translate(-288px, 0px)');

  // Docking unmounts the floating element; floating again mounts a fresh one.
  unmount();
  render(<Floating />);

  expect(floating().style.transform).toBe('translate(-288px, 0px)');
});

it('forgets the position on reset, so floating again starts at the bottom centre', () => {
  const { unmount } = render(<Floating />);
  drag({ x: 500, y: 520 }, { x: 200, y: 420 });
  fireEvent.keyDown(handle(), { key: 'Home' });

  unmount();
  render(<Floating />);

  expect(floating().style.transform).toBe('');
});

it('ignores a stored position that is not an offset', () => {
  window.localStorage.setItem('grafana.navigation.extensionSidebarFloatingOffset', '{"x":"left"}');
  render(<Floating />);

  expect(floating().style.transform).toBe('');
});

it('re-clamps when the box grows upward or the window resizes', () => {
  render(<Floating />);
  drag({ x: 700, y: 520 }, { x: 700, y: 44 });
  expect(floating().style.transform).toBe('translate(0px, -476px)');

  // Expanded upward from its bottom anchor: 600 tall, top now at 144.
  natural = { ...natural, top: 144, height: 600 };
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  expect(floating().style.transform).toBe('translate(0px, -136px)');

  // Collapsed again, it returns to the place the user chose, not the clamped one.
  natural = { ...natural, top: 500, height: 244 };
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  expect(floating().style.transform).toBe('translate(0px, -476px)');
});
