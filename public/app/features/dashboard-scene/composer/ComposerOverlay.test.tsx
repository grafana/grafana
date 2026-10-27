import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CustomVariable, SceneVariableSet, sceneGraph } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { type DashboardScene } from '../scene/DashboardScene';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { ComposerOverlay } from './ComposerOverlay';
import { ComposerSession } from './ComposerSession';
import { cropToBlob, releaseCanvas, renderNode } from './raster';
import { type ComposerAnnotation } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('./raster', () => ({
  renderNode: jest.fn(),
  cropToBlob: jest.fn(),
  releaseCanvas: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

// jsdom has no PointerEvent, so fireEvent would drop clientX, button and shiftKey from pointer events.
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

let deactivate = () => {};
let panelRoot: HTMLElement | undefined;
const originalElementsFromPoint = document.elementsFromPoint;
/** Where the stand-in panel sits in the viewport; everything else measures as the full viewport. */
let panelRect = { left: 100, top: 200, width: 400, height: 300 };
/** Where the dashboard content (the overlay and its container) sits. */
let contentRect = { left: 0, top: 0, width: 1024, height: 768 };
/** Where an extension sidebar element sits: none unless a test places one. */
let sidebarRect = { left: 0, top: 0, width: 0, height: 0 };

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  locationService.replace('/d/overlay-test');
  panelRect = { left: 100, top: 200, width: 400, height: 300 };
  contentRect = { left: 0, top: 0, width: 1024, height: 768 };
  sidebarRect = { left: 0, top: 0, width: 0, height: 0 };
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.hasAttribute('data-viz-panel-key')
      ? panelRect
      : this.hasAttribute('data-extension-sidebar')
        ? sidebarRect
        : this.getAttribute('role') === 'tooltip'
          ? { left: 0, top: 0, width: 200, height: 24 }
          : this.getAttribute('data-testid') === 'data-testid dashboard controls'
            ? { left: 0, top: 0, width: 1024, height: 64 }
            : this.getAttribute('data-dashboard-element-type') === 'variable'
              ? { left: 20, top: 10, width: 200, height: 40 }
              : contentRect;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured rect without toJSON
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  });
});

afterEach(() => {
  deactivate();
  deactivate = () => {};
  panelRoot?.remove();
  document.elementsFromPoint = originalElementsFromPoint;
  jest.restoreAllMocks();
  setTestFlags({});
});

function setup(configure?: (scene: DashboardScene) => void) {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Overlay',
      uid: 'overlay-test',
      version: 1,
      schemaVersion: 39,
      panels: [{ id: 3, type: 'text', title: 'Latency', gridPos: { x: 0, y: 0, w: 12, h: 8 } }],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  configure?.(scene);
  deactivate = scene.activate();
  const session = ComposerSession.enter(scene);

  // A stand-in for the rendered VizPanel root under the pointer.
  panelRoot = document.createElement('div');
  panelRoot.setAttribute('data-viz-panel-key', 'panel-3');
  const panelContent = document.createElement('span');
  panelRoot.appendChild(panelContent);
  document.body.appendChild(panelRoot);
  document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), panelContent];

  render(<ComposerOverlay session={session} />);
  const startPick = () => {
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(new AbortController().signal);
    });
    return pick;
  };
  const annotate = (items: ComposerAnnotation[]) => act(() => session.setAnnotations(items));
  return { session, startPick, annotate };
}

const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

const item = (overrides: Partial<ComposerAnnotation> = {}): ComposerAnnotation => ({
  id: 'a',
  ref: { kind: 'panel', panelId: 3 },
  point: { x: 0.25, y: 0.5 },
  label: '1',
  state: 'active',
  ...overrides,
});

/** Makes `element` a vertical scroll container scrolled to `top`; returns its `scrollBy`. */
function makeScrollable(element: HTMLElement, { top = 0, height = 500, contentHeight = 2000 } = {}) {
  element.style.overflowY = 'auto';
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: contentHeight });
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: top });
  const scrollBy = jest.fn();
  element.scrollBy = scrollBy;
  return scrollBy;
}

describe('wheel', () => {
  let dashboardBody: HTMLElement;

  /** The dashboard's scroll container: around the panel, and not around the overlay, as in the splitter. */
  const setupInBody = () => {
    const result = setup();
    dashboardBody = document.createElement('div');
    document.body.appendChild(dashboardBody);
    dashboardBody.appendChild(panelRoot!);
    return result;
  };

  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 200, clientY: 350, ...init });
    screen.getByTestId('dashboard-composer-overlay').dispatchEvent(event);
    return event;
  };

  afterEach(() => dashboardBody?.remove());

  it('scrolls the dashboard under the layer, though the layer is not inside it', () => {
    setupInBody();
    const scrollBy = makeScrollable(dashboardBody);

    const event = wheel({ deltaY: 120 });

    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 120 });
    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls a scrollable panel first, then the dashboard once the panel is at its end', () => {
    setupInBody();
    const bodyScrollBy = makeScrollable(dashboardBody);
    const panelScrollBy = makeScrollable(panelRoot!);

    wheel({ deltaY: 120 });
    expect(panelScrollBy).toHaveBeenCalledTimes(1);
    expect(bodyScrollBy).not.toHaveBeenCalled();

    makeScrollable(panelRoot!, { top: 1500 });
    wheel({ deltaY: 120 });
    expect(bodyScrollBy).toHaveBeenCalledWith({ left: 0, top: 120 });
  });

  it('scrolls by lines for a wheel that counts in lines', () => {
    setupInBody();
    const scrollBy = makeScrollable(dashboardBody);

    wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });

    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 48 });
  });

  it('leaves the wheel alone when nothing under it can scroll that way, and Ctrl+wheel to zoom', () => {
    setupInBody();
    const scrollBy = makeScrollable(dashboardBody);

    expect(wheel({ deltaY: -120 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 120, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe('picking', () => {
  it('resolves a click on a panel to its panel id and the normalised click point', async () => {
    const { startPick } = setup();
    const pick = startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerMove(overlay, { clientX: 200, clientY: 350 });
    fireEvent.click(overlay, { clientX: 200, clientY: 350 });

    await expect(pick).resolves.toEqual({
      ref: { kind: 'panel', panelId: 3 },
      label: 'Latency',
      tabPath: [],
      point: { x: 0.25, y: 0.5 },
    });
  });

  it('cancels the pick on Escape', async () => {
    const { startPick } = setup();
    const pick = startPick();

    fireEvent.keyDown(window, { key: 'Escape' });

    await expect(pick).resolves.toBeNull();
  });

  it('leaves Escape and pointer events inside an annotation anchor to the plugin', async () => {
    const { session, startPick, annotate } = setup();
    annotate([item()]);
    const editor = document.createElement('textarea');
    session.getAnnotationAnchor('a')!.appendChild(editor);
    const resolved = jest.fn();
    const pick = startPick();
    pick.then(resolved);

    const escape = fireEvent.keyDown(editor, { key: 'Escape' });
    fireEvent.pointerMove(editor, { clientX: 200, clientY: 350 });
    fireEvent.pointerDown(editor, { clientX: 200, clientY: 350 });
    fireEvent.click(editor, { clientX: 200, clientY: 350 });
    await act(async () => {});

    expect(escape).toBe(true); // not prevented by the overlay
    expect(resolved).not.toHaveBeenCalled();
    expect(session.getOverlayState().picking).toBe(true);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await expect(pick).resolves.toBeNull();
  });
});

describe('annotations', () => {
  it('places a numbered pin at the element-relative point and outlines only active items', () => {
    const { annotate } = setup();
    annotate([item(), item({ id: 'b', label: '1234', point: { x: 1, y: 0 }, state: 'staged' })]);

    const pin = screen.getByRole('button', { name: 'Comment 1' });
    expect(pin).toHaveStyle({ left: '200px', top: '350px' });
    expect(pin).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Comment 123' })).toHaveStyle({ left: '500px', top: '200px' });

    expect(screen.getByTestId('composer-annotation-outline-a')).toHaveStyle({
      left: '100px',
      top: '200px',
      width: '400px',
      height: '300px',
    });
    expect(screen.queryByTestId('composer-annotation-outline-b')).not.toBeInTheDocument();
  });

  it('follows the element when it moves', async () => {
    const { annotate } = setup();
    annotate([item()]);
    panelRect = { ...panelRect, top: 100 };

    fireEvent.scroll(window);
    await nextFrame();

    expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ top: '250px' });
  });

  it('hides items whose element no longer resolves', () => {
    const { session, annotate } = setup();
    annotate([item({ ref: { kind: 'panel', panelId: 99 } })]);
    expect(screen.queryByRole('button', { name: 'Comment 1' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('composer-annotation-outline-a')).not.toBeInTheDocument();
    expect(session.getAnnotationAnchor('a')).toBeNull();
  });

  it('draws pins as comment bubbles in Grafana blue, with the tail on the point', () => {
    const { annotate } = setup();
    annotate([item(), item({ id: 'b', label: '2', state: 'staged', point: { x: 1, y: 0 } })]);
    const theme = createTheme();
    const active = screen.getByRole('button', { name: 'Comment 1' });
    const staged = screen.getByRole('button', { name: 'Comment 2' });

    // The box's bottom-left corner is the tail: placed on the point and lifted by the pin's own height.
    expect(active).toHaveStyle({ left: '200px', top: '350px' });
    expect(staged).toHaveStyle({ left: '500px', top: '200px' });
    const style = getComputedStyle(staged);
    expect(style.transform).toBe('translateY(-100%)');
    expect(style.borderRadius).toBe('50% 50% 50% 0');
    // As the browser reports colours.
    const asCss = (color: string) => {
      const probe = document.createElement('div');
      probe.style.color = color;
      return probe.style.color;
    };
    expect(style.backgroundColor).toBe(asCss(theme.colors.info.main));
    expect(style.color).toBe(asCss(theme.colors.info.contrastText));
    expect(style.boxShadow).toContain(`0 0 0 2px ${theme.colors.background.primary}`);

    // Active pins are a size up.
    expect(style.width).toBe('26px');
    expect(getComputedStyle(active).width).toBe('28px');
    expect(active).toHaveAttribute('data-state', 'active');
    expect(staged).toHaveAttribute('data-state', 'staged');
  });

  it('reports pin clicks and keyboard activation', async () => {
    const { session, annotate } = setup();
    const listener = jest.fn();
    const unsubscribe = session.onAnnotationClick(listener);
    annotate([item()]);
    const pin = screen.getByRole('button', { name: 'Comment 1' });

    await userEvent.click(pin);
    pin.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(listener.mock.calls).toEqual([['a'], ['a'], ['a']]);

    unsubscribe();
    await userEvent.click(pin);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('reports pin hover and focus, and their end, until unsubscribed', () => {
    const { session, annotate } = setup();
    const listener = jest.fn();
    const unsubscribe = session.onAnnotationHover(listener);
    annotate([item(), item({ id: 'b', label: '2', state: 'staged' })]);
    const staged = screen.getByRole('button', { name: 'Comment 2' });

    fireEvent.pointerEnter(staged);
    fireEvent.pointerLeave(staged);
    act(() => staged.focus());
    act(() => staged.blur());
    expect(listener.mock.calls).toEqual([['b'], [null], ['b'], [null]]);

    unsubscribe();
    fireEvent.pointerEnter(staged);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('ignores pin hover while paused', () => {
    const { session, annotate } = setup();
    const listener = jest.fn();
    session.onAnnotationHover(listener);
    annotate([item()]);
    const pin = screen.getByRole('button', { name: 'Comment 1' });

    act(() => session.setPaused(true));
    fireEvent.pointerEnter(pin);
    fireEvent.pointerLeave(pin);
    expect(listener).not.toHaveBeenCalled();

    act(() => session.setPaused(false));
    fireEvent.pointerEnter(pin);
    expect(listener).toHaveBeenCalledWith('a');
  });

  it('releases hover and click listeners when the session ends', () => {
    const { session } = setup();
    // The unsubscribe reports whether the listener was still registered (Set#delete), which tells a
    // released listener apart from one a closed session merely ignores.
    const probe = session.onAnnotationHover(jest.fn());
    expect(probe()).toBe(true);
    expect(probe()).toBe(false);

    const unsubscribeHover = session.onAnnotationHover(jest.fn());
    const unsubscribeClick = session.onAnnotationClick(jest.fn());
    act(() => session.exit());

    expect(unsubscribeHover()).toBe(false);
    expect(unsubscribeClick()).toBe(false);
  });

  it('gives staged items an anchor too', () => {
    const { session, annotate } = setup();
    annotate([item({ state: 'staged' })]);
    expect(session.getAnnotationAnchor('a')).toBeInstanceOf(HTMLElement);
  });

  it('keeps pins visible but inert while paused', async () => {
    const { session, annotate } = setup();
    const listener = jest.fn();
    session.onAnnotationClick(listener);
    annotate([item()]);

    act(() => session.setPaused(true));
    const pin = screen.getByRole('button', { name: 'Comment 1' });
    expect(pin).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(pin);
    expect(listener).not.toHaveBeenCalled();

    act(() => session.setPaused(false));
    expect(pin).not.toHaveAttribute('aria-disabled');
    await userEvent.click(pin);
    expect(listener).toHaveBeenCalledWith('a');
  });

  it('keeps one anchor at the pin centre, across scroll and updates, until removed', async () => {
    const { session, annotate } = setup();
    expect(session.getAnnotationAnchor('a')).toBeNull();
    annotate([item()]);

    const anchor = session.getAnnotationAnchor('a')!;
    const content = document.createElement('div');
    anchor.appendChild(content);
    await nextFrame();
    const pin = screen.getByRole('button', { name: 'Comment 1' });
    expect(screen.getByTestId('dashboard-composer-overlay').parentElement).toContainElement(anchor);
    // The pin's tail tip is on the point (200, 350); the anchor is at its visual centre, half an active
    // (28px) pin right of and above the tail.
    expect(pin).toHaveStyle({ left: '200px', top: '350px' });
    expect(anchor).toHaveStyle({ position: 'absolute', left: '214px', top: '336px' });

    // Follows the element like the pin does.
    panelRect = { ...panelRect, top: 50 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(pin).toHaveStyle({ left: '200px', top: '200px' });
    expect(anchor).toHaveStyle({ left: '214px', top: '186px' });

    // The element is partly visible but the point is above the overlay: the pin, and the anchor with it,
    // stays inside the overlay.
    panelRect = { ...panelRect, top: -200 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(pin).toHaveStyle({ top: '28px' });
    expect(anchor).toHaveStyle({ left: '214px', top: '14px' });
    expect(anchor).not.toHaveStyle({ display: 'none' });

    annotate([item({ label: '2', state: 'staged' })]);
    expect(session.getAnnotationAnchor('a')).toBe(anchor);
    expect(anchor).toContainElement(content);

    annotate([]);
    expect(anchor.isConnected).toBe(false);
    expect(session.getAnnotationAnchor('a')).toBeNull();
  });

  it('hides the anchor while its element is entirely off-screen or no longer resolves', async () => {
    const { session, annotate } = setup();
    annotate([item()]);
    const anchor = session.getAnnotationAnchor('a')!;
    await nextFrame();
    expect(anchor).not.toHaveStyle({ display: 'none' });

    panelRect = { ...panelRect, top: -1000 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(anchor).toHaveStyle({ display: 'none' });

    panelRect = { ...panelRect, top: 200 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(anchor).toHaveStyle({ left: '214px', top: '336px' });
    expect(anchor).not.toHaveStyle({ display: 'none' });

    annotate([item({ ref: { kind: 'panel', panelId: 99 } })]);
    await nextFrame();
    expect(anchor).toHaveStyle({ display: 'none' });
    expect(anchor).toBeInTheDocument();
  });

  describe('revealAnnotation', () => {
    it('scrolls an element that fits into view', () => {
      const { session, annotate } = setup();
      annotate([item()]);
      const scrollIntoView = jest.fn();
      panelRoot!.scrollIntoView = scrollIntoView;

      session.revealAnnotation('a');

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });

    it('does not animate when the user prefers reduced motion', () => {
      const { session, annotate } = setup();
      annotate([item()]);
      const scrollIntoView = jest.fn();
      panelRoot!.scrollIntoView = scrollIntoView;
      jest.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only `matches` is read
          ({ matches: query === '(prefers-reduced-motion: reduce)' }) as MediaQueryList
      );

      session.revealAnnotation('a');

      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    });

    it('centres the pin point of a tall element in its scroll container', () => {
      const { session, annotate } = setup();
      annotate([item()]);
      panelRect = { left: 100, top: 200, width: 400, height: 2000 };
      const container = document.createElement('div');
      container.style.overflowY = 'auto';
      Object.defineProperty(container, 'scrollHeight', { value: 4000 });
      Object.defineProperty(container, 'clientHeight', { value: 768 });
      container.scrollBy = jest.fn();
      document.body.appendChild(container);
      container.appendChild(panelRoot!);
      const documentScroll = jest.fn();
      document.documentElement.scrollBy = documentScroll;

      session.revealAnnotation('a');

      // Point at 200 + 0.5 * 2000 = 1200, visible centre at 384.
      expect(container.scrollBy).toHaveBeenCalledWith({ top: 816, behavior: 'smooth' });
      expect(documentScroll).not.toHaveBeenCalled();
      // jsdom has no Element#scrollBy; drop the stub again.
      Reflect.deleteProperty(document.documentElement, 'scrollBy');
      container.remove();
    });

    it('does nothing for an unknown id or a closed session', () => {
      const { session, annotate } = setup();
      annotate([item()]);
      const scrollIntoView = jest.fn();
      panelRoot!.scrollIntoView = scrollIntoView;

      session.revealAnnotation('missing');
      act(() => session.exit());
      session.revealAnnotation('a');

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('removes anchors and pins when the session ends', () => {
    const { session, annotate } = setup();
    annotate([item()]);
    const anchor = session.getAnnotationAnchor('a')!;

    act(() => session.exit());

    expect(anchor.isConnected).toBe(false);
    expect(session.getAnnotationAnchor('a')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comment 1' })).not.toBeInTheDocument();
  });
});

describe('regions', () => {
  const drag = (from: { x: number; y: number }, to: { x: number; y: number }, shiftKey = false) => {
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: from.x, clientY: from.y, button: 0, shiftKey });
    fireEvent.pointerMove(overlay, { clientX: to.x, clientY: to.y });
    fireEvent.pointerUp(overlay, { clientX: to.x, clientY: to.y });
    fireEvent.click(overlay, { clientX: to.x, clientY: to.y });
  };

  const track = <T,>(promise: Promise<T>) => {
    const settled = jest.fn();
    promise.then(settled);
    return settled;
  };

  it('resolves a Shift-drag during an element pick as a region', async () => {
    const { startPick } = setup();
    const pick = startPick();

    drag({ x: 150, y: 250 }, { x: 350, y: 450 }, true);

    await expect(pick).resolves.toMatchObject({
      ref: { kind: 'region', regionId: expect.stringMatching(/^region-/) },
      label: 'Region',
      point: { x: 1, y: 0 },
      tabPath: [],
      rect: { x: 150 / 1024, y: 250 / 768, width: 200 / 1024, height: 200 / 768 },
      intersects: [{ ref: { kind: 'panel', panelId: 3 }, label: 'Latency' }],
      timeRange: { from: 'now-6h', to: 'now' },
    });
  });

  it('draws a dashed draft while dragging with the Region tool', async () => {
    const { session } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(new AbortController().signal);
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 300, clientY: 150, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 100, clientY: 30 });
    expect(screen.getByTestId('composer-region-draft')).toHaveStyle({
      left: '100px',
      top: '30px',
      width: '200px',
      height: '120px',
    });
    fireEvent.pointerUp(overlay, { clientX: 100, clientY: 30 });
    await expect(pick).resolves.toMatchObject({ ref: { kind: 'region' }, intersects: [] });
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
  });

  it('resolves a plain drag during an element pick as a region', async () => {
    const { startPick } = setup();
    const pick = startPick();

    drag({ x: 150, y: 250 }, { x: 350, y: 450 });

    await expect(pick).resolves.toMatchObject({
      ref: { kind: 'region' },
      rect: { x: 150 / 1024, y: 250 / 768, width: 200 / 1024, height: 200 / 768 },
    });
  });

  it('keeps a press with a small jitter an element click', async () => {
    const { startPick } = setup();
    const pick = startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 200, clientY: 350, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 203, clientY: 352 });
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    fireEvent.pointerUp(overlay, { clientX: 203, clientY: 352 });
    fireEvent.click(overlay, { clientX: 203, clientY: 352 });

    await expect(pick).resolves.toMatchObject({ ref: { kind: 'panel', panelId: 3 } });
  });

  it('drops a drag too thin for a region without picking the element under it', async () => {
    const { session, startPick } = setup();
    const settled = track(startPick());

    drag({ x: 200, y: 300 }, { x: 205, y: 340 });
    await act(async () => {});

    expect(settled).not.toHaveBeenCalled();
    expect(session.getOverlayState().pickMode).toBe('element');
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
  });

  it('keeps a drag a drag even when it returns near where it started', async () => {
    const { session, startPick } = setup();
    const settled = track(startPick());
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 200, clientY: 300, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 260, clientY: 300 });
    fireEvent.pointerUp(overlay, { clientX: 202, clientY: 301 });
    fireEvent.click(overlay, { clientX: 202, clientY: 301 });
    await act(async () => {});

    expect(settled).not.toHaveBeenCalled();
    expect(session.getOverlayState().pickMode).toBe('element');
  });

  it('ignores a small drag with the Region tool and swallows its click', async () => {
    const { session } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(new AbortController().signal);
    });
    const settled = track(pick);

    drag({ x: 200, y: 300 }, { x: 205, y: 340 });
    await act(async () => {});

    expect(settled).not.toHaveBeenCalled();
    expect(session.getOverlayState().pickMode).toBe('region');
  });

  it('switches tabs on a press during an element pick instead of starting a drag', async () => {
    const { startPick } = setup();
    const settled = track(startPick());
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    const onTabClick = jest.fn();
    tab.addEventListener('click', onTabClick);
    document.body.appendChild(tab);
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), tab];

    drag({ x: 10, y: 10 }, { x: 60, y: 60 });
    await act(async () => {});

    expect(onTabClick).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    tab.remove();
  });

  it('does nothing on a plain click with the Region tool', async () => {
    const { session } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(new AbortController().signal);
    });
    const settled = track(pick);

    fireEvent.click(screen.getByTestId('dashboard-composer-overlay'), { clientX: 200, clientY: 350 });
    await act(async () => {});

    expect(settled).not.toHaveBeenCalled();
    expect(session.getOverlayState().pickMode).toBe('region');
  });

  it.each([
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['pointer cancel', () => fireEvent.pointerCancel(screen.getByTestId('dashboard-composer-overlay'))],
    ['window blur', () => fireEvent.blur(window)],
    ['scroll', () => fireEvent.scroll(window)],
  ])('cancels the drag on %s and keeps the pick pending', async (_, cancel) => {
    const { startPick } = setup();
    const pick = startPick();
    const settled = track(pick);
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0, shiftKey: true });
    fireEvent.pointerMove(overlay, { clientX: 350, clientY: 450 });
    expect(screen.getByTestId('composer-region-draft')).toBeInTheDocument();
    cancel();
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    await act(async () => {});

    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    expect(settled).not.toHaveBeenCalled();

    drag({ x: 150, y: 250 }, { x: 350, y: 450 }, true);
    await expect(pick).resolves.toMatchObject({ ref: { kind: 'region' } });
  });

  async function drawRegion(startPick: () => Promise<unknown>) {
    const pick = startPick();
    drag({ x: 150, y: 250 }, { x: 350, y: 450 }, true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    return (await pick) as { ref: { kind: 'region'; regionId: string } };
  }

  it('pins a region on its top-right corner, with a faint outline when staged and a solid one when active', async () => {
    const { startPick, annotate } = setup();
    const { ref } = await drawRegion(startPick);

    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 }, state: 'staged' })]);
    expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '350px', top: '250px' });
    const outline = screen.getByTestId('composer-annotation-outline-r');
    expect(outline).toHaveAttribute('data-state', 'staged');
    expect(outline).toHaveStyle({ left: '150px', top: '250px', width: '200px', height: '200px' });

    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 }, state: 'active' })]);
    expect(screen.getByTestId('composer-annotation-outline-r')).toHaveAttribute('data-state', 'active');
  });

  it('stays on the content it was drawn over while the dashboard body scrolls under the overlay', async () => {
    const { startPick, annotate } = setup();
    // The dashboard body scrolls in its own container under the overlay, as in the sidebar layout.
    const body = document.createElement('div');
    document.body.appendChild(body);
    body.appendChild(panelRoot!);
    makeScrollable(body, { height: 768 });
    try {
      const { ref } = await drawRegion(startPick);
      annotate([item({ id: 'r', ref, point: { x: 1, y: 0 }, state: 'active' })]);

      body.scrollTop = 100;
      fireEvent.scroll(body);
      await nextFrame();

      expect(screen.getByTestId('composer-annotation-outline-r')).toHaveStyle({ left: '150px', top: '150px' });
      expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '350px', top: '150px' });
    } finally {
      body.remove();
    }
  });

  it('names the tab it was drawn on and hides while another tab is selected', async () => {
    const overview = new TabItem({ title: 'Overview' });
    const errors = new TabItem({ title: 'Errors' });
    const tabs = new TabsLayoutManager({ tabs: [overview, errors] });
    const { startPick, annotate } = setup((scene) => scene.setState({ body: tabs }));
    const pick = startPick();
    drag({ x: 150, y: 250 }, { x: 350, y: 450 }, true);
    const region = await pick;
    expect(region).toMatchObject({ label: 'Region', tabPath: ['Overview'] });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- resolved as a region above
    const { ref } = region as { ref: { kind: 'region'; regionId: string } };
    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 } })]);
    expect(screen.getByRole('button', { name: 'Comment 1' })).toBeInTheDocument();

    act(() => tabs.switchToTab(errors));
    await nextFrame();
    expect(screen.queryByRole('button', { name: 'Comment 1' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('composer-annotation-outline-r')).not.toBeInTheDocument();

    act(() => tabs.switchToTab(overview));
    await nextFrame();
    expect(screen.getByRole('button', { name: 'Comment 1' })).toBeInTheDocument();
  });

  it('passes clicks on tab headers through, so other tabs can be annotated', () => {
    setup();
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    const onTabClick = jest.fn();
    tab.addEventListener('click', onTabClick);
    document.body.appendChild(tab);
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), tab];

    fireEvent.click(screen.getByTestId('dashboard-composer-overlay'), { clientX: 10, clientY: 10 });

    expect(onTabClick).toHaveBeenCalledTimes(1);
    tab.remove();
  });

  it('stretches over content that overflows its container, so tall regions are drawn whole', async () => {
    const { session, annotate } = setup();
    const overlayRoot = screen.getByTestId('dashboard-composer-overlay').parentElement!;
    // The dashboard body overflows the container down to 2400px.
    const body = document.createElement('div');
    Object.defineProperties(body, {
      offsetTop: { value: 64 },
      offsetHeight: { value: 700 },
      scrollHeight: { value: 2336 },
      offsetLeft: { value: 0 },
      offsetWidth: { value: 1024 },
      scrollWidth: { value: 1024 },
    });
    overlayRoot.parentElement!.appendChild(body);
    // jsdom does not lay out: report the stretched overlay the way a browser would.
    contentRect = { ...contentRect, height: 2400 };
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(new AbortController().signal);
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 350, clientY: 1900 });
    expect(screen.getByTestId('composer-region-draft')).toHaveStyle({ top: '250px', height: '1650px' });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 1900 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 } })]);
    await nextFrame();

    expect(overlayRoot).toHaveStyle({ minHeight: '2400px', minWidth: '1024px' });
    expect(screen.getByTestId('composer-annotation-outline-r')).toHaveStyle({
      left: '150px',
      top: '250px',
      width: '200px',
      height: '1650px',
    });
    body.remove();
  });

  it('draws a region starting at the tab header row whole, above the sticky controls', async () => {
    const { startPick, annotate } = setup();
    const pick = startPick();
    // The tab header row sits just under the controls bar.
    drag({ x: 114, y: 55 }, { x: 193, y: 107 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 } })]);

    expect(screen.getByTestId('composer-annotation-outline-r')).toHaveStyle({
      left: '114px',
      top: '55px',
      width: '79px',
      height: '52px',
    });
    expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '193px', top: '55px' });
    const overlayRoot = screen.getByTestId('dashboard-composer-overlay').parentElement!;
    // The sticky dashboard controls are at theme.zIndex.sidemenu in the same stacking context.
    expect(Number(getComputedStyle(overlayRoot).zIndex)).toBeGreaterThan(createTheme().zIndex.sidemenu);
  });

  it('clamps a drag that starts above the overlay to its top, and captures the clamped box', async () => {
    const { session, annotate } = setup();
    contentRect = { ...contentRect, top: 100 };
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(new AbortController().signal);
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 40, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 350, clientY: 300 });
    expect(screen.getByTestId('composer-region-draft')).toHaveStyle({ top: '0px', height: '200px' });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 300 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 } })]);

    expect(screen.getByTestId('composer-annotation-outline-r')).toHaveStyle({ top: '0px', height: '200px' });
    // A corner pin on the overlay's top edge is kept whole inside it: its tail drops to a pin's height.
    expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '350px', top: '28px' });
    expect(session.resolveBox(ref, overlay.parentElement!.getBoundingClientRect())).toEqual({
      left: 150,
      top: 0,
      width: 200,
      height: 200,
    });
  });

  it('switches tabs with the Region tool active instead of starting a drag', async () => {
    const { session } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(new AbortController().signal);
    });
    const settled = track(pick);
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    const onTabClick = jest.fn();
    tab.addEventListener('click', onTabClick);
    document.body.appendChild(tab);
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), tab];

    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 12, clientY: 11 });
    fireEvent.pointerUp(overlay, { clientX: 12, clientY: 11 });
    fireEvent.click(overlay, { clientX: 12, clientY: 11 });
    await act(async () => {});

    expect(onTabClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    expect(settled).not.toHaveBeenCalled();
    expect(session.getOverlayState().pickMode).toBe('region');
    tab.remove();
  });

  it('forgets a region once no annotation references it', async () => {
    const { session, startPick, annotate } = setup();
    const { ref } = await drawRegion(startPick);
    annotate([item({ id: 'r', ref })]);
    expect(session.getAnnotationAnchor('r')).not.toBeNull();

    annotate([]);
    annotate([item({ id: 'r', ref })]);

    expect(screen.queryByRole('button', { name: 'Comment 1' })).not.toBeInTheDocument();
    expect(session.getAnnotationAnchor('r')).toBeNull();
  });
});

describe('region capture', () => {
  const mockRenderNode = jest.mocked(renderNode);
  const mockCropToBlob = jest.mocked(cropToBlob);
  const mockReleaseCanvas = jest.mocked(releaseCanvas);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
  const raster = { width: 2048, height: 1536 } as HTMLCanvasElement;
  const webp = new Blob(['webp'], { type: 'image/webp' });
  const live = () => new AbortController().signal;

  beforeEach(() => {
    mockRenderNode.mockReset().mockResolvedValue(raster);
    mockCropToBlob.mockReset().mockResolvedValue(webp);
    mockReleaseCanvas.mockReset();
  });

  async function drawRegion(session: ComposerSession) {
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(live());
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    return ((await pick) as { ref: { kind: 'region'; regionId: string } }).ref.regionId;
  }

  async function capture(session: ComposerSession, regionId: string) {
    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(regionId, live());
    });
    return result;
  }

  function start(session: ComposerSession, regionId: string) {
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = session.captureRegion(regionId, live());
    });
    return pending;
  }

  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
  }

  it('renders the dashboard without Composer or the sidebar and crops at the raster scale', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);
    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-extension-sidebar', '');

    const result = await capture(session, regionId);

    expect(result).toEqual({ status: 'ready', image: webp, width: 400, height: 400, capturedAt: expect.any(String) });
    const overlayRoot = screen.getByTestId('dashboard-composer-overlay').parentElement!;
    const [node, { filter }] = mockRenderNode.mock.calls[0];
    expect(node).toBe(overlayRoot.parentElement);
    expect(filter(overlayRoot)).toBe(false);
    expect(filter(sidebar)).toBe(false);
    expect(filter(panelRoot!)).toBe(true);
    // A 1024px wide dashboard rendered 2048px wide: 2 raster pixels per CSS pixel.
    expect(mockCropToBlob).toHaveBeenCalledWith(
      raster,
      { sx: 300, sy: 500, sw: 400, sh: 400, width: 400, height: 400 },
      'image/webp',
      0.85
    );
    expect(mockReleaseCanvas).toHaveBeenCalledWith(raster);
  });

  it('renders only the smallest element that holds the region', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);
    const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
    const grid = document.createElement('div');
    container.appendChild(grid);
    grid.appendChild(panelRoot!);

    await capture(session, regionId);

    // The region (150..350 x 250..450) lies inside the panel (100..500 x 200..500).
    expect(mockRenderNode.mock.calls[0][0]).toBe(panelRoot);
    // Crop relative to the panel: a 400px wide panel rendered 2048px wide is 5.12 raster px per CSS px.
    expect(mockCropToBlob).toHaveBeenCalledWith(
      raster,
      { sx: 256, sy: 256, sw: 1024, sh: 1024, width: 1024, height: 1024 },
      'image/webp',
      0.85
    );
  });

  it('captures the same box the outline draws', async () => {
    const { session, annotate } = setup();
    const regionId = await drawRegion(session);
    annotate([item({ id: 'r', ref: { kind: 'region', regionId }, point: { x: 1, y: 0 } })]);
    const outline = screen.getByTestId('composer-annotation-outline-r');

    await capture(session, regionId);

    // The container renders at 2 raster px per CSS px and sits at the viewport origin, like the overlay.
    const { sx, sy, sw, sh } = mockCropToBlob.mock.calls[0][1];
    expect([sx / 2, sy / 2, sw / 2, sh / 2]).toEqual(
      ['left', 'top', 'width', 'height'].map((side) => parseFloat(outline.style.getPropertyValue(side)))
    );
  });

  it('widens the render root until it holds a region that runs past its panels', async () => {
    const { session } = setup();
    const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
    const grid = document.createElement('div');
    container.appendChild(grid);
    grid.appendChild(panelRoot!);
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(live());
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    // Starts left of the panel (which begins at x=100).
    fireEvent.pointerDown(overlay, { clientX: 50, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { regionId } = ((await pick) as { ref: { regionId: string } }).ref;

    await capture(session, regionId);

    expect(mockRenderNode.mock.calls[0][0]).toBe(grid);
  });

  it('runs one capture at a time and locks picking and tabs until it settles', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);
    const render = deferred<HTMLCanvasElement>();
    mockRenderNode.mockReturnValue(render.promise);

    const first = start(session, regionId);
    await expect(session.captureRegion(regionId, live())).resolves.toEqual({ status: 'failed', reason: 'busy' });
    expect(session.getOverlayState().capturing).toBe(true);

    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    const onTabClick = jest.fn();
    tab.addEventListener('click', onTabClick);
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay'), tab];
    fireEvent.click(screen.getByTestId('dashboard-composer-overlay'), { clientX: 10, clientY: 10 });
    expect(onTabClick).not.toHaveBeenCalled();

    await act(async () => {
      render.resolve(raster);
      await first;
    });
    await expect(first).resolves.toMatchObject({ status: 'ready' });
    expect(session.getOverlayState().capturing).toBe(false);
  });

  it('times out after 10 seconds and drops the late result', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);
    const render = deferred<HTMLCanvasElement>();
    mockRenderNode.mockReturnValue(render.promise);
    jest.useFakeTimers();
    try {
      const pending = start(session, regionId);
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      await expect(pending).resolves.toEqual({ status: 'failed', reason: 'timeout' });

      await act(async () => render.resolve(raster));
      expect(mockCropToBlob).not.toHaveBeenCalled();
      expect(mockReleaseCanvas).toHaveBeenCalledWith(raster);
    } finally {
      jest.useRealTimers();
    }
  });

  it('is not_visible unless the region is fully in view, and when the page scrolls mid-capture', async () => {
    const { session } = setup();
    // The dashboard body scrolls in its own container under the overlay, as in the sidebar layout.
    const body = document.createElement('div');
    document.body.appendChild(body);
    body.appendChild(panelRoot!);
    makeScrollable(body, { height: 768 });
    try {
      const regionId = await drawRegion(session);

      body.scrollTop = 300;
      await expect(capture(session, regionId)).resolves.toEqual({ status: 'failed', reason: 'not_visible' });
      expect(mockRenderNode).not.toHaveBeenCalled();

      body.scrollTop = 0;
      mockRenderNode.mockReturnValue(deferred<HTMLCanvasElement>().promise);
      const pending = start(session, regionId);
      await act(async () => {
        fireEvent.scroll(window);
        await pending;
      });
      await expect(pending).resolves.toEqual({ status: 'failed', reason: 'not_visible' });
    } finally {
      body.remove();
    }
  });

  it('reports tainted content as unsupported and an oversized dashboard as too_large', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);

    mockCropToBlob.mockRejectedValue(new DOMException('Tainted canvas', 'SecurityError'));
    await expect(capture(session, regionId)).resolves.toEqual({ status: 'failed', reason: 'unsupported' });

    contentRect = { ...contentRect, height: 20_000 };
    await expect(capture(session, regionId)).resolves.toEqual({ status: 'failed', reason: 'too_large' });
  });

  it('fails for an unknown region or a closed session', async () => {
    const { session } = setup();
    const regionId = await drawRegion(session);
    await expect(session.captureRegion('region-unknown', live())).resolves.toEqual({
      status: 'failed',
      reason: 'failed',
    });
    act(() => session.exit());
    await expect(session.captureRegion(regionId, live())).resolves.toEqual({ status: 'failed', reason: 'failed' });
  });
});

// Composer is a mode, not a layout: the user may dock the extension sidebar next to the page and stay in it.
describe('with the extension sidebar docked', () => {
  let sidebar: HTMLElement | undefined;

  beforeEach(() => {
    jest
      .mocked(renderNode)
      .mockReset()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
        { width: 1400, height: 1536 } as HTMLCanvasElement
      );
    jest
      .mocked(cropToBlob)
      .mockReset()
      .mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    // The docked column beside the page, which narrows from 1024px to 700px.
    sidebar = document.createElement('div');
    sidebar.setAttribute('data-extension-sidebar', '');
    document.body.appendChild(sidebar);
    contentRect = { ...contentRect, width: 700 };
    sidebarRect = { left: 700, top: 0, width: 324, height: 768 };
  });

  afterEach(() => sidebar?.remove());

  it('moves pins with the content when the page narrows, without a scroll or window resize', async () => {
    const callbacks = new Map<Element, () => void>();
    const original = window.ResizeObserver;
    class ManualResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        callbacks.set(target, () => this.callback([], this));
      }
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ManualResizeObserver;
    try {
      const { annotate } = setup();
      annotate([item()]);
      expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '200px' });

      // Docking narrows the dashboard container, and the grid lays the panel out narrower.
      panelRect = { ...panelRect, width: 200 };
      const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
      act(() => callbacks.get(container)?.());
      await nextFrame();

      expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '150px' });
    } finally {
      window.ResizeObserver = original;
    }
  });

  it('still picks panels and draws regions', async () => {
    const { session, startPick } = setup();
    const pick = startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.click(overlay, { clientX: 200, clientY: 350 });
    await expect(pick).resolves.toMatchObject({ ref: { kind: 'panel', panelId: 3 } });

    let region: Promise<unknown> = Promise.resolve();
    act(() => {
      region = session.pickRegion(new AbortController().signal);
    });
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    await expect(region).resolves.toMatchObject({ ref: { kind: 'region' } });
  });

  it('lets a drag run on under the docked column when the content overflows under it', async () => {
    // Content wider than the page: the overlay reaches under the docked column.
    contentRect = { ...contentRect, width: 1024 };
    const { session, startPick } = setup();
    const pick = startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 500, clientY: 100, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 900, clientY: 300 });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    expect(session.resolveBox(ref, overlay.parentElement!.getBoundingClientRect())).toMatchObject({
      left: 500,
      width: 400,
    });
  });

  it('captures a region without the docked sidebar, at the narrower page scale', async () => {
    const { session } = setup();
    let region: Promise<unknown> = Promise.resolve();
    act(() => {
      region = session.pickRegion(new AbortController().signal);
    });
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { regionId } = ((await region) as { ref: { kind: 'region'; regionId: string } }).ref;

    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(regionId, new AbortController().signal);
    });

    expect(result).toMatchObject({ status: 'ready', width: 400, height: 400 });
    const [, { filter }] = jest.mocked(renderNode).mock.calls[0];
    expect(filter(sidebar!)).toBe(false);
    // A 700px wide page rendered 1400px wide: 2 raster pixels per CSS pixel.
    expect(jest.mocked(cropToBlob)).toHaveBeenCalledWith(
      expect.anything(),
      { sx: 300, sy: 500, sw: 400, sh: 400, width: 400, height: 400 },
      'image/webp',
      0.85
    );
  });
});

// The floating Assistant sits above the overlay; it is never part of the document Composer annotates.
describe('with the extension sidebar floating', () => {
  let sidebar: HTMLElement;

  beforeEach(() => {
    sidebar = document.createElement('div');
    sidebar.setAttribute('data-extension-sidebar', '');
    document.body.appendChild(sidebar);
    // The floating panel in the bottom-right corner of a 1024x768 page.
    sidebarRect = { left: 600, top: 500, width: 400, height: 244 };
  });

  afterEach(() => sidebar.remove());

  function settledFlag(pick: Promise<unknown>) {
    const state = { settled: false };
    void pick.then(() => (state.settled = true));
    return state;
  }

  it('never starts a pick or a region from a press inside it', async () => {
    const { startPick } = setup();
    const pick = startPick();
    const state = settledFlag(pick);
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 700, clientY: 600, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 200, clientY: 300 });
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    fireEvent.pointerUp(overlay, { clientX: 200, clientY: 300 });
    fireEvent.click(overlay, { clientX: 700, clientY: 600 });
    await act(() => Promise.resolve());

    expect(state.settled).toBe(false);
  });

  it('shows no hint or hover while the pointer is over it', async () => {
    const { startPick } = setup();
    startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerMove(overlay, { clientX: 700, clientY: 600 });
    await nextFrame();

    expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
  });

  it('lets a drag run on under it to the full rectangle, and captures the document there without it', async () => {
    jest
      .mocked(renderNode)
      .mockReset()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
        { width: 2048, height: 1536 } as HTMLCanvasElement
      );
    jest
      .mocked(cropToBlob)
      .mockReset()
      .mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    const { session, startPick } = setup();
    const pick = startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');

    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 800, clientY: 700 });
    // The draft reaches under the panel at (600, 500); the panel paints above the overlay.
    expect(screen.getByTestId('composer-region-draft')).toHaveStyle({
      left: '150px',
      top: '250px',
      width: '650px',
      height: '450px',
    });
    fireEvent.pointerUp(overlay, { clientX: 800, clientY: 700 });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    expect(session.resolveBox(ref, overlay.parentElement!.getBoundingClientRect())).toEqual({
      left: 150,
      top: 250,
      width: 650,
      height: 450,
    });

    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(ref.regionId, new AbortController().signal);
    });
    expect(result).toMatchObject({ status: 'ready' });
    const [, { filter }] = jest.mocked(renderNode).mock.calls[0];
    // The document under the Assistant is rendered; the Assistant is not.
    expect(filter(sidebar)).toBe(false);
    expect(filter(panelRoot!)).toBe(true);
    expect(jest.mocked(cropToBlob)).toHaveBeenCalledWith(
      expect.anything(),
      { sx: 300, sy: 500, sw: 1300, sh: 900, width: 1300, height: 900 },
      'image/webp',
      0.85
    );
  });
});

describe('dashboard controls', () => {
  function mountControls() {
    const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
    const controls = document.createElement('div');
    controls.setAttribute('data-testid', 'data-testid dashboard controls');
    const save = document.createElement('button');
    save.textContent = 'Save';
    controls.appendChild(save);
    container.appendChild(controls);
    return { controls, save };
  }
  const blocker = () => screen.getByTestId('dashboard-composer-overlay');

  it('lets the pointer through to the controls band and blocks the body again below it', () => {
    const { startPick } = setup();
    startPick();
    const { save } = mountControls();
    const onSave = jest.fn();
    save.addEventListener('click', onSave);

    fireEvent.pointerMove(window, { clientX: 100, clientY: 30 });
    // Transparent to the pointer, so the real Save, Refresh and time picker receive it.
    expect(blocker()).toHaveStyle({ pointerEvents: 'none' });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(window, { clientX: 100, clientY: 300 });
    expect(blocker().style.pointerEvents).toBe('');
  });

  it('never starts a pick or a region from a press on the controls', async () => {
    const { startPick } = setup();
    const settled = jest.fn();
    startPick().then(settled);
    mountControls();

    fireEvent.pointerDown(blocker(), { clientX: 100, clientY: 30, button: 0 });
    fireEvent.pointerMove(blocker(), { clientX: 300, clientY: 300 });
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    fireEvent.pointerUp(blocker(), { clientX: 300, clientY: 300 });
    await act(async () => {});

    expect(settled).not.toHaveBeenCalled();
  });

  it('shows no hint over the controls', () => {
    jest.useFakeTimers();
    try {
      const { startPick } = setup();
      startPick();
      mountControls();
      fireEvent.pointerMove(window, { clientX: 100, clientY: 30 });
      fireEvent.pointerMove(blocker(), { clientX: 100, clientY: 30 });
      act(() => {
        jest.advanceTimersByTime(16);
      });
      expect(screen.queryByRole('tooltip', { hidden: true })).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('draws a region from a drag that starts on the controls, and keeps its click from the control', async () => {
    const { startPick } = setup();
    const pick = startPick();
    const { save } = mountControls();
    const onSave = jest.fn();
    save.addEventListener('click', onSave);

    fireEvent.pointerDown(save, { clientX: 100, clientY: 30, button: 0 });
    fireEvent.pointerMove(window, { clientX: 140, clientY: 120 });
    expect(screen.getByTestId('composer-region-draft')).toHaveStyle({
      left: '100px',
      top: '30px',
      width: '40px',
      height: '90px',
    });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 300 });
    fireEvent.pointerUp(save, { clientX: 400, clientY: 300 });
    fireEvent.click(save);

    expect(onSave).not.toHaveBeenCalled();
    await expect(pick).resolves.toMatchObject({
      ref: { kind: 'region' },
      rect: { x: 100 / 1024, y: 30 / 768, width: 300 / 1024, height: 270 / 768 },
    });
  });

  it('leaves a press on the controls that moves less than 8px to the control', async () => {
    const { startPick } = setup();
    const settled = jest.fn();
    startPick().then(settled);
    const { save } = mountControls();
    const onSave = jest.fn();
    save.addEventListener('click', onSave);

    fireEvent.pointerDown(save, { clientX: 100, clientY: 30, button: 0 });
    fireEvent.pointerMove(window, { clientX: 104, clientY: 33 });
    fireEvent.pointerUp(save, { clientX: 104, clientY: 33 });
    fireEvent.click(save);
    await act(async () => {});

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
  });

  it('blurs a control the drag started on', () => {
    const { startPick } = setup();
    startPick();
    const { save } = mountControls();
    save.focus();
    expect(save).toHaveFocus();

    fireEvent.pointerDown(save, { clientX: 100, clientY: 30, button: 0 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });

    expect(save).not.toHaveFocus();
  });

  it('keeps pins drawn over the controls clickable', async () => {
    const { session, startPick, annotate } = setup();
    const pick = startPick();
    fireEvent.pointerDown(blocker(), { clientX: 150, clientY: 40, button: 0 });
    fireEvent.pointerMove(blocker(), { clientX: 350, clientY: 200 });
    fireEvent.pointerUp(blocker(), { clientX: 350, clientY: 200 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    mountControls();
    annotate([item({ id: 'r', ref, point: { x: 1, y: 0 } })]);
    const listener = jest.fn();
    session.onAnnotationClick(listener);

    fireEvent.pointerMove(window, { clientX: 350, clientY: 40 });
    await userEvent.click(screen.getByRole('button', { name: 'Comment 1' }));

    expect(listener).toHaveBeenCalledWith('r');
  });
});

describe('variables', () => {
  function withVariable(scene: DashboardScene) {
    scene.setState({
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: 'env', label: 'Environment', query: 'dev,prod' })],
      }),
    });
  }

  /** A stand-in for the variable's control in the dashboard controls: a label and a value picker. */
  function mountVariableControl(scene: DashboardScene) {
    const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
    const controls = document.createElement('div');
    controls.setAttribute('data-testid', 'data-testid dashboard controls');
    const control = document.createElement('div');
    control.setAttribute('data-dashboard-element-type', 'variable');
    control.setAttribute('data-dashboard-element-key', sceneGraph.lookupVariable('env', scene)!.state.key!);
    const label = document.createElement('label');
    label.textContent = 'Environment';
    const value = document.createElement('button');
    value.textContent = 'dev';
    control.append(label, value);
    controls.appendChild(control);
    container.appendChild(controls);
    return { label, value };
  }

  it('picks a variable from a click on its label', async () => {
    let scene: DashboardScene | undefined;
    const { startPick } = setup((s) => {
      withVariable(s);
      scene = s;
    });
    const pick = startPick();
    const { label } = mountVariableControl(scene!);

    const clicked = fireEvent.click(label);

    expect(clicked).toBe(false); // the label does not go on to focus the value picker
    await expect(pick).resolves.toEqual({
      ref: { kind: 'variable', name: 'env' },
      label: 'Environment',
      tabPath: [],
      point: { x: 1, y: 0 },
    });
  });

  it('leaves the value picker working', async () => {
    let scene: DashboardScene | undefined;
    const { startPick } = setup((s) => {
      withVariable(s);
      scene = s;
    });
    const settled = jest.fn();
    startPick().then(settled);
    const { value } = mountVariableControl(scene!);
    const onOpen = jest.fn();
    value.addEventListener('click', onOpen);

    fireEvent.click(value);
    await act(async () => {});

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
  });

  it('lists variables a region covers among its intersects', async () => {
    let scene: DashboardScene | undefined;
    const { startPick } = setup((s) => {
      withVariable(s);
      scene = s;
    });
    const pick = startPick();
    const { label } = mountVariableControl(scene!);

    fireEvent.pointerDown(label, { clientX: 15, clientY: 5, button: 0 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(label, { clientX: 300, clientY: 300 });

    await expect(pick).resolves.toMatchObject({
      ref: { kind: 'region' },
      intersects: [
        { ref: { kind: 'panel', panelId: 3 }, label: 'Latency' },
        { ref: { kind: 'variable', name: 'env' }, label: 'Environment' },
      ],
    });
  });

  it('outlines a variable and pins it on its top-right corner', () => {
    let scene: DashboardScene | undefined;
    const { annotate } = setup((s) => {
      withVariable(s);
      scene = s;
    });
    mountVariableControl(scene!);

    annotate([item({ id: 'v', ref: { kind: 'variable', name: 'env' }, point: { x: 1, y: 0 } })]);

    expect(screen.getByTestId('composer-annotation-outline-v')).toHaveStyle({
      left: '20px',
      top: '10px',
      width: '200px',
      height: '40px',
    });
    // Tail on the top-right corner (220, 10), held a pin's height inside the overlay's top edge.
    expect(screen.getByRole('button', { name: 'Comment 1' })).toHaveStyle({ left: '220px', top: '28px' });
  });
});

describe('pick hint', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const PANEL_HINT = 'Click to comment on a panel, or drag to draw a region';
  const EMPTY_HINT = 'Drag to draw a region';
  const hint = () => screen.queryByRole('tooltip', { hidden: true });
  const frame = () =>
    act(() => {
      jest.advanceTimersByTime(16);
    });
  const move = (x: number, y: number) =>
    fireEvent.pointerMove(screen.getByTestId('dashboard-composer-overlay'), { clientX: x, clientY: y });

  it('follows the pointer, one position write per animation frame', () => {
    const { startPick } = setup();
    startPick();

    move(200, 350);
    move(210, 360);
    expect(hint()).not.toBeInTheDocument();
    frame();
    expect(hint()).toHaveTextContent(PANEL_HINT);
    // Only the last move of the frame is applied: 12px down-right of (210, 360).
    expect(hint()!.style.transform).toBe('translate(222px, 372px)');

    move(300, 400);
    expect(hint()!.style.transform).toBe('translate(222px, 372px)');
    frame();
    expect(hint()!.style.transform).toBe('translate(312px, 412px)');
  });

  it('says only how to draw over empty space', () => {
    const { startPick } = setup();
    startPick();
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay')];

    move(900, 300);
    frame();

    expect(hint()).toHaveTextContent(EMPTY_HINT);
  });

  it('flips left and up near the right and bottom edges of the viewport', () => {
    const { startPick } = setup();
    startPick();
    document.elementsFromPoint = () => [screen.getByTestId('dashboard-composer-overlay')];

    move(950, 750);
    frame();

    // A 200x24 hint left of and above the pointer: 950 - 12 - 200 and 750 - 12 - 24.
    expect(hint()!.style.transform).toBe('translate(738px, 714px)');
  });

  it('hides while dragging and when the pointer leaves the overlay for a pin, then comes back', () => {
    const { startPick } = setup();
    startPick();
    const overlay = screen.getByTestId('dashboard-composer-overlay');
    move(200, 350);
    frame();
    expect(hint()).toBeInTheDocument();

    fireEvent.pointerDown(overlay, { clientX: 200, clientY: 350, button: 0 });
    move(260, 420);
    frame();
    expect(hint()).not.toBeInTheDocument();
    fireEvent.pointerCancel(overlay);

    move(205, 355);
    frame();
    expect(hint()).toBeInTheDocument();

    fireEvent.pointerLeave(overlay);
    expect(hint()).not.toBeInTheDocument();
    move(210, 360);
    frame();
    expect(hint()).toBeInTheDocument();
  });

  it('does not show without a pending pick or during a capture', () => {
    const { session, startPick } = setup();
    move(200, 350);
    frame();
    expect(hint()).not.toBeInTheDocument();

    startPick();
    jest.spyOn(session, 'getOverlayState').mockReturnValue({ ...session.getOverlayState(), capturing: true });
    act(() => session.highlight(null));
    move(200, 350);
    frame();
    expect(hint()).not.toBeInTheDocument();
  });

  it('keeps showing for later picks', async () => {
    const { startPick } = setup();
    const pick = startPick();
    fireEvent.click(screen.getByTestId('dashboard-composer-overlay'), { clientX: 200, clientY: 350 });
    await act(async () => {
      await pick;
    });

    startPick();
    move(200, 350);
    frame();
    expect(hint()).toHaveTextContent(PANEL_HINT);
  });
});
