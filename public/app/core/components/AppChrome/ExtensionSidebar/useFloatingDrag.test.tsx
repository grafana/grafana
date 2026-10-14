import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { FLOATING_DRAG_HANDLE_ATTRIBUTE, useFloatingDrag } from './useFloatingDrag';

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

/** The floating box at rest in its corner: 24px from the right and bottom of a 1024x768 viewport. */
let natural = { left: 600, top: 500, width: 400, height: 244 };
/** How far the handle sticks out past the box's left edge (0: inside the box). */
let handleOutset = 0;
const onHandleClick = jest.fn();

function Floating() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const { moved } = useFloatingDrag(element);
  return (
    <div ref={setElement} data-testid="floating" data-moved={moved}>
      <button type="button" {...{ [FLOATING_DRAG_HANDLE_ATTRIBUTE]: '' }} onClick={onHandleClick}>
        Move
      </button>
    </div>
  );
}

beforeEach(() => {
  natural = { left: 600, top: 500, width: 400, height: 244 };
  handleOutset = 0;
  onHandleClick.mockClear();
  window.localStorage.clear();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
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

afterEach(() => jest.restoreAllMocks());

const handle = () => screen.getByRole('button', { name: 'Move' });
const floating = () => screen.getByTestId('floating');

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(handle(), { clientX: from.x, clientY: from.y, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(handle(), { clientX: to.x, clientY: to.y });
  fireEvent.click(handle());
}

it('moves the floating box by dragging its handle, kept inside the page with a gutter', () => {
  render(<Floating />);

  drag({ x: 700, y: 520 }, { x: 500, y: 320 });
  expect(floating().style.transform).toBe('translate(-200px, -200px)');
  expect(floating()).toHaveAttribute('data-moved', 'true');
  // The handle's click does not fire after a move.
  expect(onHandleClick).not.toHaveBeenCalled();

  drag({ x: 500, y: 320 }, { x: -2000, y: -2000 });
  // Left edge at 24 (600 - 576) and top edge at 24 (500 - 476).
  expect(floating().style.transform).toBe('translate(-576px, -476px)');

  drag({ x: 0, y: 0 }, { x: 5000, y: 5000 });
  expect(floating().style.transform).toBe('');
});

it('keeps a handle that sits outside the box on the page too, without moving the corner', () => {
  handleOutset = 28;
  render(<Floating />);
  expect(floating().style.transform).toBe('');

  drag({ x: 590, y: 520 }, { x: -2000, y: 520 });

  // The flag's left edge (600 - 28 - 548 = 24) stops at the gutter, not the box's.
  expect(floating().style.transform).toBe('translate(-548px, 0px)');
});

it('treats a press that moves less than 4px as a click on the handle', () => {
  render(<Floating />);
  drag({ x: 700, y: 520 }, { x: 702, y: 523 });
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
  expect(floating()).toHaveAttribute('data-moved', 'false');

  fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
  fireEvent.doubleClick(handle());
  expect(floating().style.transform).toBe('');
});

it('does not remember the position: floating again starts in the corner', () => {
  const getItem = jest.spyOn(Storage.prototype, 'getItem');
  const setItem = jest.spyOn(Storage.prototype, 'setItem');
  const { unmount } = render(<Floating />);
  drag({ x: 700, y: 520 }, { x: 600, y: 420 });
  expect(floating().style.transform).toBe('translate(-100px, -100px)');

  // Docking unmounts the floating element; floating again mounts a fresh one.
  unmount();
  render(<Floating />);

  expect(floating().style.transform).toBe('');
  expect(floating()).toHaveAttribute('data-moved', 'false');
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
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
  expect(floating().style.transform).toBe('translate(0px, -120px)');
});
