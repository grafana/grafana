import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { ComposerOverlay } from './ComposerOverlay';
import { ComposerSession } from './ComposerSession';
import { type ComposerAnnotation } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};
let panelRoot: HTMLElement | undefined;
const originalElementsFromPoint = document.elementsFromPoint;
/** Where the stand-in panel sits in the viewport; everything else measures as the full viewport. */
let panelRect = { left: 100, top: 200, width: 400, height: 300 };

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  locationService.replace('/d/overlay-test');
  panelRect = { left: 100, top: 200, width: 400, height: 300 };
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.hasAttribute('data-viz-panel-key')
      ? panelRect
      : { left: 0, top: 0, width: 1024, height: 768 };
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

function setup() {
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

  it('keeps one anchor at the top-centre of the visible element, across scroll and updates, until removed', async () => {
    const { session, annotate } = setup();
    expect(session.getAnnotationAnchor('a')).toBeNull();
    annotate([item()]);

    const anchor = session.getAnnotationAnchor('a')!;
    const content = document.createElement('div');
    anchor.appendChild(content);
    await nextFrame();
    expect(screen.getByTestId('dashboard-composer-overlay').parentElement).toContainElement(anchor);
    expect(anchor).toHaveStyle({ position: 'absolute', left: '300px', top: '200px' });

    // Scrolled so the element's top is above the viewport: the anchor clamps to the visible top.
    panelRect = { ...panelRect, top: -50 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(anchor).toHaveStyle({ left: '300px', top: '0px' });

    // Entirely out of view: falls back to the pin's point, clamped to the viewport.
    panelRect = { ...panelRect, top: -1000 };
    fireEvent.scroll(window);
    await nextFrame();
    expect(anchor).toHaveStyle({ left: '200px', top: '0px' });

    annotate([item({ label: '2', state: 'staged' })]);
    expect(session.getAnnotationAnchor('a')).toBe(anchor);
    expect(anchor).toContainElement(content);

    annotate([]);
    expect(anchor.isConnected).toBe(false);
    expect(session.getAnnotationAnchor('a')).toBeNull();
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
