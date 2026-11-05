import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { reportInteraction } from '@grafana/runtime';

import {
  FLOATING_DRAG_HANDLE_ATTRIBUTE,
  FLOATING_SNAP_DURATION_MS,
  useDockedDrag,
  useFloatingDrag,
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

function Floating() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const preview = useFloatingDrag(element, { dockWidth: 360, onDock, canCollapse: () => collapsible, onCollapse });
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

beforeEach(() => {
  natural = { left: 312, top: 500, width: 400, height: 244 };
  handleOutset = 0;
  onHandleClick.mockClear();
  onDock.mockClear();
  onCollapse.mockClear();
  collapsible = true;
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
    top: 0,
    left: 664,
    width: 360,
    height: 768,
  });

  fireEvent.pointerUp(handle(), { clientX: 1000, clientY: 300 });
  fireEvent.click(handle());
  expect(onDock).toHaveBeenCalledTimes(1);
  expect(onCollapse).not.toHaveBeenCalled();
  expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
  expect(onHandleClick).not.toHaveBeenCalled();
  expect(reportInteraction).not.toHaveBeenCalled();
  // Docking does not remember where the drag left the box.
  expect(window.localStorage.getItem('grafana.navigation.extensionSidebarFloatingOffset')).toBeNull();
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
  function Sidebar({ floatingWidth = 480 }: { floatingWidth?: number }) {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const [isFloating, setIsFloating] = useState(false);
    useFloatingDrag(isFloating ? element : null, { dockWidth: 360, onDock, canCollapse: () => false, onCollapse });
    const preview = useDockedDrag(isFloating ? null : element, floatingWidth, () => {
      onFloat();
      natural = floatingBox;
      setIsFloating(true);
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
    fireEvent.pointerMove(handle(), { clientX: 10, clientY: 760 });

    expect(preview()).toMatchObject({ left: 8, top: 592 });
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
});
