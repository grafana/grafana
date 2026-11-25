import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { FloatingHeightHandle } from './FloatingHeightHandle';
import {
  FLOATING_DRAG_HANDLE_ATTRIBUTE,
  FLOATING_SNAP_DURATION_MS,
  keepFloatingBottomEdge,
  useDockedDrag,
  useFloatingDrag,
  useFloatingHeightRoom,
} from './useFloatingDrag';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

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
const onDock = jest.fn();
const onCollapse = jest.fn();
/** Whether the extension has anything to collapse. */
let collapsible = true;
/** Whether pushing against the left edge docks there; off, like the flag that turns it on. */
let leftDockable = false;
/** Whether taking the pointer to the bottom edge docks there; off, like the flag that turns it on. */
let bottomDockable = false;

function Floating({ children }: { children?: ReactNode }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const preview = useFloatingDrag(element, {
    dockWidth: 360,
    dockHeight: 320,
    onDock,
    canDockLeft: () => leftDockable,
    canDockBottom: () => bottomDockable,
    canCollapse: () => collapsible,
    onCollapse,
  });
  return (
    <>
      <div ref={setElement} data-testid="floating">
        <button type="button" {...{ [FLOATING_DRAG_HANDLE_ATTRIBUTE]: '' }} onClick={onHandleClick}>
          Move
        </button>
        {children}
      </div>
      {preview && <div data-testid="preview">{JSON.stringify(preview)}</div>}
    </>
  );
}

beforeEach(() => {
  natural = { left: 312, top: 500, width: 400, height: 244 };
  handleOutset = 0;
  onHandleClick.mockClear();
  onDock.mockClear();
  onCollapse.mockClear();
  collapsible = true;
  leftDockable = false;
  bottomDockable = false;
  jest.mocked(reportInteraction).mockClear();
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

// The box's centre is above the page's middle (384) once moved up by more than 238px.
it.each([
  ['top', { x: -250, y: -400 }, 'translate(-250px, -400px)'],
  ['bottom', { x: 250, y: -50 }, 'translate(250px, -50px)'],
])('stays where it is let go and reports the edge it keeps: %s', (anchor, by, transform) => {
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 500 + by.x, y: 520 + by.y });

  expect(floating().style.transform).toBe(transform);
  expect(floating()).not.toHaveAttribute('data-dragging');
  // The handle's click does not fire after a move.
  expect(onHandleClick).not.toHaveBeenCalled();
  expect(reportInteraction).toHaveBeenCalledTimes(1);
  expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_moved', {
    method: 'drag',
    anchor,
  });
});

// Snapped edges keep the default's 24px inset: left edge 24 (x -288), right edge 1000 (x 288), top edge 24 (y -476).
it.each([
  ['left', { x: -290, y: -200 }, 'translate(-288px, -200px)'],
  ['right', { x: 270, y: -200 }, 'translate(288px, -200px)'],
  ['top', { x: 0, y: -460 }, 'translate(0px, -476px)'],
  ['top-left corner', { x: -290, y: -460 }, 'translate(-288px, -476px)'],
  ['bottom', { x: 100, y: -10 }, 'translate(100px, 0px)'],
])('glides to an edge it is let go within 48px of: %s', (_edge, by, transform) => {
  jest.useFakeTimers();
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 500 + by.x, y: 520 + by.y });

  expect(floating().style.transform).toBe(transform);
  expect(floating()).toHaveAttribute('data-snapping');
  act(() => {
    jest.advanceTimersByTime(FLOATING_SNAP_DURATION_MS);
  });
  expect(floating()).not.toHaveAttribute('data-snapping');
  jest.useRealTimers();
});

it('does not glide when let go away from the edges, or moved with the arrow keys', () => {
  render(<Floating />);

  drag({ x: 500, y: 520 }, { x: 400, y: 320 });
  expect(floating()).not.toHaveAttribute('data-snapping');

  handle().focus();
  fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
  fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
  fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
  // Left edge at 20: inside the snap distance, but keys never snap.
  expect(floating().style.transform).toBe('translate(-292px, -200px)');
  expect(floating()).not.toHaveAttribute('data-snapping');
});

it('previews the docked sidebar while the pointer is at the right edge, and docks when let go there', () => {
  render(<Floating />);
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

  // The box stops at the gutter 304px right; 16px further is not a push yet.
  fireEvent.pointerMove(handle(), { clientX: 820, clientY: 300 });
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

  // Within 32px of the window's right edge (1024).
  fireEvent.pointerMove(handle(), { clientX: 1000, clientY: 300 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toEqual({
    action: 'dock',
    side: 'right',
    top: 0,
    left: 664,
    width: 360,
    height: 768,
  });

  fireEvent.pointerUp(handle(), { clientX: 1000, clientY: 300 });
  fireEvent.click(handle());
  expect(onDock).toHaveBeenCalledTimes(1);
  expect(onDock).toHaveBeenCalledWith('right');
  expect(onCollapse).not.toHaveBeenCalled();
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  expect(onHandleClick).not.toHaveBeenCalled();
  expect(reportInteraction).not.toHaveBeenCalled();
  // Docking does not remember where the drag left the box.
  expect(window.localStorage.getItem('grafana.navigation.extensionSidebarFloatingOffset')).toBeNull();
});

describe('docking on the left', () => {
  beforeEach(() => {
    leftDockable = true;
  });

  it('previews the docked sidebar at the left edge while the pointer is there, and docks there when let go', () => {
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    // The box stops at the gutter 304px left; 16px further is not a push yet.
    fireEvent.pointerMove(handle(), { clientX: 180, clientY: 300 });
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

    // Within 32px of the page's left edge.
    fireEvent.pointerMove(handle(), { clientX: 20, clientY: 300 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toEqual({
      action: 'dock',
      side: 'left',
      top: 0,
      left: 0,
      width: 360,
      height: 768,
    });

    fireEvent.pointerUp(handle(), { clientX: 20, clientY: 300 });
    fireEvent.click(handle());
    expect(onDock).toHaveBeenCalledTimes(1);
    expect(onDock).toHaveBeenCalledWith('left');
    expect(onHandleClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  });

  it('docks after the docked menu, which the page content reserves as padding', () => {
    const pageContent = document.createElement('div');
    pageContent.id = 'pageContent';
    pageContent.style.paddingLeft = '320px';
    document.body.appendChild(pageContent);
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    // Over the menu: the box stays on the page content while the drag pushes on past its left edge.
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toEqual({
      action: 'dock',
      side: 'left',
      top: 0,
      left: 320,
      width: 360,
      height: 768,
    });
  });

  it('switches the preview to the right edge when the drag goes there', () => {
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    fireEvent.pointerMove(handle(), { clientX: 20, clientY: 300 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ side: 'left' });
    fireEvent.pointerMove(handle(), { clientX: 1000, clientY: 300 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ side: 'right' });

    fireEvent.pointerUp(handle(), { clientX: 1000, clientY: 300 });
    expect(onDock).toHaveBeenCalledWith('right');
  });

  it('only moves the box against the left edge while left docking is off', () => {
    leftDockable = false;
    render(<Floating />);

    drag({ x: 500, y: 520 }, { x: 20, y: 300 });

    expect(onDock).not.toHaveBeenCalled();
    // Snapped to the left edge, 24px in.
    expect(floating().style.transform).toBe('translate(-288px, -220px)');
  });
});

it('does not dock when the pointer leaves the right edge before letting go, or the drag is cancelled', () => {
  render(<Floating />);

  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: 1000, clientY: 300 });
  fireEvent.pointerMove(handle(), { clientX: 800, clientY: 300 });
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  fireEvent.pointerUp(handle(), { clientX: 800, clientY: 300 });

  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });
  fireEvent.pointerMove(handle(), { clientX: 1000, clientY: 300 });
  fireEvent.pointerCancel(handle(), { clientX: 1000, clientY: 300 });
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

  expect(onDock).not.toHaveBeenCalled();
});

it('previews the collapsed box while pushed down past the bottom edge, and collapses it there when let go', () => {
  render(<Floating />);
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

  // The box stops at the 8px gutter, 16px down; the drag goes 224px further.
  fireEvent.pointerMove(handle(), { clientX: 500, clientY: 760 });
  expect(floating().style.transform).toBe('translate(0px, 16px)');
  // Lined up with the bottom of the box (760).
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toEqual({
    action: 'collapse',
    top: 592,
    left: 312,
    width: 400,
    height: 168,
  });

  // The preview follows the box along the bottom edge.
  fireEvent.pointerMove(handle(), { clientX: 400, clientY: 760 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ left: 212 });

  fireEvent.pointerUp(handle(), { clientX: 400, clientY: 760 });
  // Snapped to the bottom edge, then collapsed.
  expect(floating().style.transform).toBe('translate(-100px, 0px)');
  expect(onCollapse).toHaveBeenCalledTimes(1);
  expect(onDock).not.toHaveBeenCalled();
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
});

it('collapses a tall box pushed against the bottom edge, though the pointer is far from it', () => {
  // Expanded: its bottom edge 24px from the bottom, its header near the top.
  natural = { ...natural, top: 144, height: 600 };
  render(<Floating />);
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 160, button: 0 });

  // The box stops 16px down, at the gutter; pushing 54px further is not enough.
  fireEvent.pointerMove(handle(), { clientX: 500, clientY: 230 });
  expect(floating().style.transform).toBe('translate(0px, 16px)');
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

  // 74px past where it stopped.
  fireEvent.pointerMove(handle(), { clientX: 500, clientY: 250 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ action: 'collapse' });

  fireEvent.pointerUp(handle(), { clientX: 500, clientY: 250 });
  expect(onCollapse).toHaveBeenCalledTimes(1);
});

it('does not collapse a box resting at the bottom that is moved sideways and drifts down', () => {
  render(<Floating />);

  // 54px down from where it stops, 16px down.
  drag({ x: 500, y: 520 }, { x: 700, y: 590 });

  expect(onCollapse).not.toHaveBeenCalled();
  expect(floating().style.transform).toBe('translate(200px, 0px)');
});

it('offers no collapse while there is nothing to collapse, but still docks from the corner', () => {
  collapsible = false;
  render(<Floating />);
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

  fireEvent.pointerMove(handle(), { clientX: 500, clientY: 760 });
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  // In the corner the bottom would win, but there is nothing to collapse.
  fireEvent.pointerMove(handle(), { clientX: 900, clientY: 790 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ action: 'dock' });

  fireEvent.pointerMove(handle(), { clientX: 500, clientY: 760 });
  fireEvent.pointerUp(handle(), { clientX: 500, clientY: 760 });
  // It only snaps to the bottom.
  expect(floating().style.transform).toBe('');
  expect(onCollapse).not.toHaveBeenCalled();
  expect(onDock).not.toHaveBeenCalled();
});

it('in the bottom-right corner, does what the harder push does', () => {
  render(<Floating />);
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

  // 96px past the right stop and 254px past the bottom one.
  fireEvent.pointerMove(handle(), { clientX: 900, clientY: 790 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ action: 'collapse' });

  // 216px past the right stop and 214px past the bottom one.
  fireEvent.pointerMove(handle(), { clientX: 1020, clientY: 750 });
  expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ action: 'dock' });
});

describe('docking at the bottom', () => {
  beforeEach(() => {
    bottomDockable = true;
  });

  it('collapses while pushed down, and docks at the bottom once the pointer reaches the bottom edge', () => {
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    // 164px past where the box stopped, but 68px from the bottom edge: a collapse.
    fireEvent.pointerMove(handle(), { clientX: 500, clientY: 700 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ action: 'collapse' });

    // Within 32px of the bottom edge (768): the strip across the page, 320px tall.
    fireEvent.pointerMove(handle(), { clientX: 500, clientY: 750 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toEqual({
      action: 'dock',
      side: 'bottom',
      top: 448,
      left: 0,
      width: 1024,
      height: 320,
    });

    fireEvent.pointerUp(handle(), { clientX: 500, clientY: 750 });
    fireEvent.click(handle());
    expect(onDock).toHaveBeenCalledWith('bottom');
    expect(onCollapse).not.toHaveBeenCalled();
    expect(onHandleClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  });

  it('docks after the docked menu, which the page content reserves as padding', () => {
    const pageContent = document.createElement('div');
    pageContent.id = 'pageContent';
    pageContent.style.paddingLeft = '320px';
    document.body.appendChild(pageContent);
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    fireEvent.pointerMove(handle(), { clientX: 500, clientY: 750 });

    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({
      side: 'bottom',
      left: 320,
      width: 704,
    });
  });

  it('in the bottom-right corner, docks on the edge the drag pushes harder', () => {
    render(<Floating />);
    fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0 });

    fireEvent.pointerMove(handle(), { clientX: 560, clientY: 760 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ side: 'bottom' });

    // 211px past the right stop.
    fireEvent.pointerMove(handle(), { clientX: 1015, clientY: 760 });
    expect(JSON.parse(screen.getByTestId('preview').textContent ?? '')).toMatchObject({ side: 'right' });
  });

  it('only collapses at the bottom edge while bottom docking is off', () => {
    bottomDockable = false;
    render(<Floating />);

    drag({ x: 500, y: 520 }, { x: 500, y: 750 });

    expect(onDock).not.toHaveBeenCalled();
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
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
  // Snapped to the left edge, the flag's edge is 24px in (312 - 28 - 260 = 24).
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
  // Snapped 24px past the menu, at 124.
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

  // Each reset is reported; the arrow-key steps are not.
  expect(jest.mocked(reportInteraction).mock.calls).toEqual([
    ['grafana_extension_sidebar_floating_moved', { method: 'reset', anchor: 'bottom' }],
    ['grafana_extension_sidebar_floating_moved', { method: 'reset', anchor: 'bottom' }],
  ]);
});

it('remembers the position: floating again starts where it was left', () => {
  const { unmount } = render(<Floating />);
  drag({ x: 500, y: 520 }, { x: 300, y: 420 });
  expect(floating().style.transform).toBe('translate(-200px, -100px)');

  // Docking unmounts the floating element; floating again mounts a fresh one.
  unmount();
  render(<Floating />);

  expect(floating().style.transform).toBe('translate(-200px, -100px)');
});

it('reads a position stored before anchors as an offset from the bottom centre', () => {
  window.localStorage.setItem('grafana.navigation.extensionSidebarFloatingOffset', '{"x":-100,"y":-50}');
  render(<Floating />);

  expect(floating().style.transform).toBe('translate(-100px, -50px)');
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

function resizeBox(box: { top: number; height: number }) {
  natural = { ...natural, ...box };
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

it('left in the top half, keeps its top edge as the box grows and shrinks, and after floating again', () => {
  const { unmount } = render(<Floating />);
  drag({ x: 700, y: 520 }, { x: 700, y: 44 });
  // Top edge at 24.
  expect(floating().style.transform).toBe('translate(0px, -476px)');

  // Expanded: 600 tall, its untranslated top at 144. The top edge stays at 24.
  resizeBox({ top: 144, height: 600 });
  expect(floating().style.transform).toBe('translate(0px, -120px)');

  resizeBox({ top: 500, height: 244 });
  expect(floating().style.transform).toBe('translate(0px, -476px)');

  // Floating again expanded, the top edge is still at 24.
  unmount();
  natural = { ...natural, top: 144, height: 600 };
  render(<Floating />);
  expect(floating().style.transform).toBe('translate(0px, -120px)');
});

it('left in the bottom half, keeps its bottom edge, re-clamped while the box has no room', () => {
  render(<Floating />);
  drag({ x: 700, y: 520 }, { x: 700, y: 320 });
  expect(floating().style.transform).toBe('translate(0px, -200px)');

  // Expanded upward: 600 tall, top at 144. Its bottom edge would put the top off the page, so it stops at 8.
  resizeBox({ top: 144, height: 600 });
  expect(floating().style.transform).toBe('translate(0px, -136px)');

  // Collapsed again, it returns to the place the user chose, not the clamped one.
  resizeBox({ top: 500, height: 244 });
  expect(floating().style.transform).toBe('translate(0px, -200px)');
});

it.each([
  [
    'dragged',
    (resize: HTMLElement) => {
      fireEvent.pointerDown(resize, { clientY: 200, button: 0 });
      fireEvent.pointerMove(resize, { clientY: 184 });
      fireEvent.pointerUp(resize, { clientY: 184 });
    },
  ],
  ['stepped with the arrow keys', (resize: HTMLElement) => fireEvent.keyDown(resize, { key: 'ArrowUp' })],
])('keeps its bottom edge when resized from its top edge, though left in the top half: %s', (_how, resizeFromTop) => {
  const { unmount } = render(
    <Floating>
      <FloatingHeightHandle
        edge="top"
        options={{ minHeight: 100 }}
        height={undefined}
        onHeightChange={jest.fn()}
        onWidthChange={jest.fn()}
      />
    </Floating>
  );
  // Top edge at 200, so anchored there.
  drag({ x: 700, y: 520 }, { x: 700, y: 220 });
  expect(floating().style.transform).toBe('translate(0px, -300px)');

  resizeFromTop(screen.getByRole('separator', { name: 'Resize sidebar height' }));
  // 16px taller. Untranslated, the container keeps its bottom edge, so its top is 16px higher.
  resizeBox({ top: 484, height: 260 });
  // The top edge moved up to 184 with the resize, and the bottom edge stayed at 444.
  expect(floating().style.transform).toBe('translate(0px, -300px)');

  // Floating again, it is where the resize left it.
  unmount();
  render(<Floating />);
  expect(floating().style.transform).toBe('translate(0px, -300px)');
});

describe('the room a remembered height is held to', () => {
  // In ExtensionSidebar's order: the room is read before the drag places the box.
  function FloatingWithRoom() {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const room = useFloatingHeightRoom(element);
    useFloatingDrag(element, {
      dockWidth: 360,
      dockHeight: 320,
      onDock,
      canDockLeft: () => false,
      canDockBottom: () => false,
      canCollapse: () => false,
      onCollapse,
    });
    return (
      <div ref={setElement} data-testid="floating">
        <span data-testid="room">{room}</span>
      </div>
    );
  }
  const room = () => screen.getByTestId('room');

  it('reaches up to the gutter under the top bar, for a box kept at its bottom edge', () => {
    render(<FloatingWithRoom />);
    // 744 at the bottom, less the 8px gutter.
    expect(room()).toHaveTextContent('736');
  });

  it('reaches down to the gutter above the page bottom, for a box left in the top half', () => {
    window.localStorage.setItem(
      'grafana.navigation.extensionSidebarFloatingOffset',
      JSON.stringify({ x: 0, y: 100, anchor: 'top' })
    );
    render(<FloatingWithRoom />);
    expect(floating().style.transform).toBe('translate(0px, -400px)');
    // Its top edge at 100 stays, so it can grow down to 760.
    expect(room()).toHaveTextContent('660');

    resizeBox({ top: 500, height: 244 });
    expect(room()).toHaveTextContent('660');
  });

  it('follows the bottom edge once a resize from the top edge keeps it, as the handles do', () => {
    window.localStorage.setItem(
      'grafana.navigation.extensionSidebarFloatingOffset',
      JSON.stringify({ x: 0, y: 100, anchor: 'top' })
    );
    render(<FloatingWithRoom />);
    expect(room()).toHaveTextContent('660');

    act(() => keepFloatingBottomEdge());
    // 344 at the bottom (its top at 100, 244 tall), less the 8px gutter: the room the handles resize within.
    expect(room()).toHaveTextContent('336');
  });
});

it('moves only by its handle, with the primary button, following the pointer that grabbed it', () => {
  render(<Floating />);

  fireEvent.pointerDown(floating(), { clientX: 500, clientY: 520, button: 0 });
  fireEvent.pointerMove(floating(), { clientX: 300, clientY: 320 });
  fireEvent.pointerUp(floating(), { clientX: 300, clientY: 320 });
  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 2 });
  fireEvent.pointerMove(handle(), { clientX: 300, clientY: 320 });
  fireEvent.pointerUp(handle(), { clientX: 300, clientY: 320 });
  expect(floating().style.transform).toBe('');

  fireEvent.pointerDown(handle(), { clientX: 500, clientY: 520, button: 0, pointerId: 1 });
  fireEvent.pointerMove(handle(), { clientX: 300, clientY: 320, pointerId: 2 });
  fireEvent.pointerUp(handle(), { clientX: 300, clientY: 320, pointerId: 2 });
  expect(floating().style.transform).toBe('');
  expect(floating()).not.toHaveAttribute('data-dragging');
});

it('ignores arrow keys pressed away from its handle', () => {
  render(<Floating />);

  fireEvent.keyDown(floating(), { key: 'ArrowLeft' });

  expect(floating().style.transform).toBe('');
});

describe('dragged from the docked sidebar', () => {
  const docked = { left: 664, top: 40, width: 360, height: 728 };
  const floatingBox = { left: 312, top: 500, width: 400, height: 244 };
  const onFloat = jest.fn();

  /** The sidebar docked until a drag floats it; the same element, as in ExtensionSidebar. */
  function Sidebar({
    floatingWidth = 480,
    dockSide = 'right',
  }: {
    floatingWidth?: number;
    dockSide?: 'left' | 'right' | 'bottom';
  }) {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const [isFloating, setIsFloating] = useState(false);
    useFloatingDrag(isFloating ? element : null, {
      dockWidth: 360,
      dockHeight: 320,
      onDock,
      canDockLeft: () => false,
      canDockBottom: () => false,
      canCollapse: () => false,
      onCollapse,
    });
    const preview = useDockedDrag(isFloating ? null : element, {
      dockSide,
      dockWidth: 360,
      dockHeight: 320,
      floatingWidth,
      onFloat: () => {
        onFloat();
        natural = floatingBox;
        setIsFloating(true);
      },
      onDock,
      canDockLeft: () => leftDockable,
      canDockBottom: () => bottomDockable,
    });
    return (
      <>
        <div ref={setElement} data-testid="floating">
          <button type="button" {...{ [FLOATING_DRAG_HANDLE_ATTRIBUTE]: '' }} onClick={onHandleClick}>
            Move
          </button>
        </div>
        {preview && <div data-testid="preview">{JSON.stringify(preview)}</div>}
      </>
    );
  }

  const preview = () => JSON.parse(screen.getByTestId('preview').textContent ?? '');

  beforeEach(() => {
    natural = docked;
    onFloat.mockClear();
    leftDockable = true;
    bottomDockable = true;
  });

  it('stays put and previews nothing until the pointer is pulled 40px left of where it was grabbed', () => {
    render(<Sidebar />);

    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 900, clientY: 300 });
    fireEvent.pointerMove(handle(), { clientX: 870, clientY: 300 });
    expect(floating()).toHaveAttribute('data-dragging');
    expect(floating().style.transform).toBe('');
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

    fireEvent.pointerMove(handle(), { clientX: 860, clientY: 300 });
    expect(preview()).toMatchObject({ action: 'float', width: 480, height: 168 });

    // Held by its header: the pointer 16px below its top.
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });
    expect(preview()).toEqual({ action: 'float', left: 60, top: 284, width: 480, height: 168 });
  });

  it('previews the floating width the user resized it to', () => {
    render(<Sidebar floatingWidth={400} />);

    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });

    expect(preview()).toEqual({ action: 'float', left: 100, top: 284, width: 400, height: 168 });
  });

  it('previews as soon as the pointer is past its left edge, when grabbed near it', () => {
    render(<Sidebar />);

    fireEvent.pointerDown(handle(), { clientX: 680, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 670, clientY: 300 });
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

    fireEvent.pointerMove(handle(), { clientX: 660, clientY: 300 });
    expect(preview()).toMatchObject({ action: 'float' });
  });

  it('floats where it is let go, with its top edge kept there', () => {
    render(<Sidebar />);
    drag({ x: 700, y: 60 }, { x: 300, y: 300 });

    expect(onFloat).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    // Top left corner at (60, 284), where the preview was.
    expect(floating().style.transform).toBe('translate(-252px, -216px)');
    expect(JSON.parse(window.localStorage.getItem('grafana.navigation.extensionSidebarFloatingOffset') ?? '')).toEqual({
      x: -252,
      y: 284,
      anchor: 'top',
    });
  });

  it('lets the preview cover the sidebar, whose room the page content takes once it floats', () => {
    const pageContent = document.createElement('div');
    pageContent.id = 'pageContent';
    pageContent.style.paddingRight = '360px';
    document.body.appendChild(pageContent);
    render(<Sidebar />);

    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 860, clientY: 60 });

    // Centred on the pointer, short of the sidebar's right edge (1024) by the gutter.
    expect(preview()).toMatchObject({ left: 536, top: 44 });
  });

  it('only starts from the handle, with the primary button', () => {
    render(<Sidebar />);

    fireEvent.pointerDown(floating(), { clientX: 900, clientY: 60, button: 0 });
    fireEvent.pointerMove(floating(), { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(floating(), { clientX: 300, clientY: 300 });
    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 2 });
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(handle(), { clientX: 300, clientY: 300 });

    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    expect(floating()).not.toHaveAttribute('data-dragging');
    expect(onFloat).not.toHaveBeenCalled();
  });

  it('follows only the pointer that grabbed the handle', () => {
    render(<Sidebar />);

    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300, pointerId: 2 });
    fireEvent.pointerUp(handle(), { clientX: 300, clientY: 300, pointerId: 2 });
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle(), { clientX: 300, clientY: 300, pointerId: 1 });
    expect(onFloat).toHaveBeenCalledTimes(1);
  });

  it('treats a press that barely moves as a click on the handle', () => {
    render(<Sidebar />);

    fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 898, clientY: 61 });
    fireEvent.pointerUp(handle(), { clientX: 898, clientY: 61 });
    fireEvent.click(handle());

    expect(floating()).not.toHaveAttribute('data-dragging');
    expect(onFloat).not.toHaveBeenCalled();
    expect(onHandleClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the preview inside the page', () => {
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { clientX: 700, clientY: 60, button: 0 });
    // Short of the bottom edge, which docks there.
    fireEvent.pointerMove(handle(), { clientX: 40, clientY: 730 });

    expect(preview()).toMatchObject({ action: 'float', left: 8, top: 592 });
  });

  describe('docking on the other side', () => {
    beforeEach(() => {
      // The page content reserves the docked nav as padding.
      const pageContent = document.createElement('div');
      pageContent.id = 'pageContent';
      pageContent.style.paddingLeft = '320px';
      document.body.appendChild(pageContent);
    });

    it('previews the sidebar docked after the nav once the pointer reaches it, and docks there when let go', () => {
      render(<Sidebar />);

      fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 352, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });

      fireEvent.pointerMove(handle(), { clientX: 351, clientY: 300 });
      expect(preview()).toEqual({ action: 'dock', side: 'left', top: 0, left: 320, width: 360, height: 768 });
      // Over the nav too.
      fireEvent.pointerMove(handle(), { clientX: 100, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'dock', side: 'left' });

      fireEvent.pointerUp(handle(), { clientX: 100, clientY: 300 });
      fireEvent.click(handle());

      expect(onDock).toHaveBeenCalledWith('left');
      expect(onFloat).not.toHaveBeenCalled();
      expect(onHandleClick).not.toHaveBeenCalled();
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    });

    it('floats instead when the pointer leaves the edge before letting go, and docks nowhere when cancelled', () => {
      render(<Sidebar />);
      fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 330, clientY: 300 });
      fireEvent.pointerCancel(handle(), { clientX: 330, clientY: 300 });

      expect(onDock).not.toHaveBeenCalled();
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

      fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 330, clientY: 300 });
      fireEvent.pointerMove(handle(), { clientX: 500, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });
      fireEvent.pointerUp(handle(), { clientX: 500, clientY: 300 });

      expect(onDock).not.toHaveBeenCalled();
      expect(onFloat).toHaveBeenCalledTimes(1);
    });

    it('docked on the left, previews the sidebar at the right edge once the pointer reaches it, and docks there', () => {
      natural = { left: 320, top: 40, width: 360, height: 728 };
      document.getElementById('pageContent')!.style.paddingLeft = '680px';
      render(<Sidebar dockSide="left" />);

      fireEvent.pointerDown(handle(), { clientX: 400, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 992, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });

      fireEvent.pointerMove(handle(), { clientX: 993, clientY: 300 });
      expect(preview()).toEqual({ action: 'dock', side: 'right', top: 0, left: 664, width: 360, height: 768 });

      fireEvent.pointerUp(handle(), { clientX: 993, clientY: 300 });

      expect(onDock).toHaveBeenCalledWith('right');
      expect(onFloat).not.toHaveBeenCalled();
    });

    it('floats at the left and bottom edges while those docks are off', () => {
      leftDockable = false;
      bottomDockable = false;
      render(<Sidebar />);

      fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 100, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });
      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 760 });
      expect(preview()).toMatchObject({ action: 'float' });
      fireEvent.pointerUp(handle(), { clientX: 600, clientY: 760 });

      expect(onDock).not.toHaveBeenCalled();
      expect(onFloat).toHaveBeenCalledTimes(1);
    });

    it('does not dock on the side it is already docked on', () => {
      render(<Sidebar />);

      drag({ x: 700, y: 60 }, { x: 1020, y: 300 });

      expect(onDock).not.toHaveBeenCalled();
      expect(onFloat).not.toHaveBeenCalled();
    });

    it('docked on the right, previews the strip at the bottom once the pointer reaches it, and docks there', () => {
      render(<Sidebar />);

      fireEvent.pointerDown(handle(), { clientX: 900, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 736 });
      expect(preview()).toMatchObject({ action: 'float' });

      // Within 32px of the bottom edge: across the page past the nav, up to the sidebar's own right edge.
      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 737 });
      expect(preview()).toEqual({ action: 'dock', side: 'bottom', top: 448, left: 320, width: 704, height: 320 });

      // In to the left edge's corner: the nearer edge.
      fireEvent.pointerMove(handle(), { clientX: 340, clientY: 740 });
      expect(preview()).toMatchObject({ action: 'dock', side: 'left' });

      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 760 });
      fireEvent.pointerUp(handle(), { clientX: 600, clientY: 760 });

      expect(onDock).toHaveBeenCalledWith('bottom');
      expect(onFloat).not.toHaveBeenCalled();
    });
  });

  describe('docked at the bottom, after the nav', () => {
    const dockedBottom = { left: 320, top: 448, width: 704, height: 320 };

    beforeEach(() => {
      natural = dockedBottom;
      // The page content reserves the nav as padding, and ends where the sidebar starts.
      const pageContent = document.createElement('div');
      pageContent.id = 'pageContent';
      pageContent.style.paddingLeft = '320px';
      document.body.appendChild(pageContent);
    });

    it('previews nothing until the pointer is pulled 40px up from where it was grabbed, then floats there', () => {
      render(<Sidebar dockSide="bottom" />);

      fireEvent.pointerDown(handle(), { clientX: 600, clientY: 500, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 700, clientY: 470 });
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 455 });
      expect(preview()).toEqual({ action: 'float', left: 360, top: 439, width: 480, height: 168 });

      fireEvent.pointerUp(handle(), { clientX: 600, clientY: 455 });
      expect(onFloat).toHaveBeenCalledTimes(1);
      expect(onDock).not.toHaveBeenCalled();
    });

    it('previews as soon as the pointer is above its top edge, when grabbed near it', () => {
      render(<Sidebar dockSide="bottom" />);

      fireEvent.pointerDown(handle(), { clientX: 600, clientY: 460, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 452 });
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

      fireEvent.pointerMove(handle(), { clientX: 600, clientY: 444 });
      expect(preview()).toMatchObject({ action: 'float' });
    });

    it('docks on the left or the right side once the pointer reaches that edge', () => {
      render(<Sidebar dockSide="bottom" />);

      fireEvent.pointerDown(handle(), { clientX: 600, clientY: 500, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 340, clientY: 600 });
      // The page's full height, which the page takes back from the strip.
      expect(preview()).toEqual({ action: 'dock', side: 'left', top: 0, left: 320, width: 360, height: 768 });

      fireEvent.pointerMove(handle(), { clientX: 1010, clientY: 600 });
      expect(preview()).toEqual({ action: 'dock', side: 'right', top: 0, left: 664, width: 360, height: 768 });

      fireEvent.pointerUp(handle(), { clientX: 1010, clientY: 600 });
      expect(onDock).toHaveBeenCalledWith('right');
      expect(onFloat).not.toHaveBeenCalled();
    });

    it('still docks on the right while the left dock is off', () => {
      leftDockable = false;
      render(<Sidebar dockSide="bottom" />);

      fireEvent.pointerDown(handle(), { clientX: 600, clientY: 500, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 340, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });
      fireEvent.pointerMove(handle(), { clientX: 1010, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'dock', side: 'right' });
    });

    it('does not dock at the bottom it is already docked at', () => {
      render(<Sidebar dockSide="bottom" />);

      drag({ x: 600, y: 500 }, { x: 600, y: 760 });

      expect(onDock).not.toHaveBeenCalled();
      expect(onFloat).not.toHaveBeenCalled();
    });
  });

  it('does not float when the pointer comes back over the sidebar before letting go, or the drag is cancelled', () => {
    render(<Sidebar />);
    fireEvent.pointerDown(handle(), { clientX: 700, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(handle(), { clientX: 700, clientY: 300 });
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    fireEvent.pointerUp(handle(), { clientX: 700, clientY: 300 });
    fireEvent.click(handle());

    fireEvent.pointerDown(handle(), { clientX: 700, clientY: 60, button: 0 });
    fireEvent.pointerMove(handle(), { clientX: 300, clientY: 300 });
    fireEvent.pointerCancel(handle(), { clientX: 300, clientY: 300 });

    expect(onFloat).not.toHaveBeenCalled();
    expect(onHandleClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    expect(floating()).not.toHaveAttribute('data-dragging');
  });

  describe('docked on the left, after the nav', () => {
    const dockedLeft = { left: 320, top: 40, width: 360, height: 728 };

    beforeEach(() => {
      natural = dockedLeft;
      // The page content reserves the nav and the sidebar as padding.
      const pageContent = document.createElement('div');
      pageContent.id = 'pageContent';
      pageContent.style.paddingLeft = '680px';
      document.body.appendChild(pageContent);
    });

    it('previews nothing until the pointer is pulled 40px right of where it was grabbed', () => {
      render(<Sidebar dockSide="left" />);

      fireEvent.pointerDown(handle(), { clientX: 400, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 430, clientY: 60 });
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

      fireEvent.pointerMove(handle(), { clientX: 440, clientY: 60 });
      // Kept inside the sidebar's room and the page, which it takes back once floating: from 320 + the gutter.
      expect(preview()).toEqual({ action: 'float', left: 328, top: 44, width: 480, height: 168 });
    });

    it('previews as soon as the pointer is past its right edge, when grabbed near it', () => {
      render(<Sidebar dockSide="left" />);

      fireEvent.pointerDown(handle(), { clientX: 670, clientY: 60, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 676, clientY: 300 });
      expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

      fireEvent.pointerMove(handle(), { clientX: 684, clientY: 300 });
      expect(preview()).toMatchObject({ action: 'float' });
    });

    it('does not float when pulled toward the nav', () => {
      render(<Sidebar dockSide="left" />);

      drag({ x: 600, y: 60 }, { x: 300, y: 300 });

      expect(onFloat).not.toHaveBeenCalled();
      expect(onHandleClick).not.toHaveBeenCalled();
    });

    it('floats where it is let go', () => {
      // Floating, the sidebar gives its room back to the page.
      onFloat.mockImplementationOnce(() => {
        document.getElementById('pageContent')!.style.paddingLeft = '320px';
      });
      render(<Sidebar dockSide="left" />);

      drag({ x: 400, y: 60 }, { x: 800, y: 300 });

      expect(onFloat).toHaveBeenCalledTimes(1);
      // Top left corner at (536, 284): centred on the pointer, short of the page's right edge by the gutter.
      expect(floating().style.transform).toBe('translate(224px, -216px)');
    });
  });
});
