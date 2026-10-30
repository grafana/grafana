import { act, fireEvent, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { contextSrv } from 'app/core/services/context_srv';
import { ComposerOverlay } from 'app/features/dashboard-scene/composer/ComposerOverlay';
import { cropToBlob, releaseCanvas, renderNode } from 'app/features/dashboard-scene/composer/raster';
import { composerApi } from 'app/features/plugins/components/restrictedGrafanaApis/composer/composerApi';

import { NOTEBOOKS_FLAG } from '../mutation-api/test-utils';
import { NotebookEmbeddedHost } from '../scene/NotebookEmbeddedContext';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { enterNotebookComposer } from './NotebookComposerDocument';
import { setRouteNotebook } from './notebookComposerAccess';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

jest.mock('app/features/dashboard-scene/composer/raster', () => ({
  renderNode: jest.fn(),
  cropToBlob: jest.fn(),
  releaseCanvas: jest.fn(),
}));

// The real editor does not run in jsdom (see NotebookScene.test.tsx).
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({ value }: { value: string }) => <textarea readOnly value={value} />,
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

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

const CELL_RECT = { left: 100, top: 200, width: 600, height: 300 };
const CONTENT_RECT = { left: 0, top: 0, width: 1024, height: 768 };
/** The floating Assistant in the bottom-right corner, where a test places one. */
const FLOATING_RECT = { left: 600, top: 500, width: 400, height: 244 };
const originalElementsFromPoint = document.elementsFromPoint;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  setTestFlags({ [NOTEBOOKS_FLAG]: true, 'grafana.notebookComposer': true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.hasAttribute('data-notebook-cell-key')
      ? CELL_RECT
      : this.hasAttribute('data-extension-sidebar')
        ? FLOATING_RECT
        : CONTENT_RECT;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured rect without toJSON
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.elementsFromPoint = originalElementsFromPoint;
  jest.restoreAllMocks();
  resetExtensionSidebarPresentationForTests();
  setTestFlags({});
});

function buildNotebook() {
  const scene = new NotebookScene({
    title: 'Incident notes',
    uid: 'nb-overlay',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          key: 'cell-summary',
          elementName: 'summary',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: '## Checkout is slow\nSince the deploy' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  cleanups.push(scene.activate());
  cleanups.push(setRouteNotebook(scene));
  return scene;
}

/** The overlay over a stand-in for the notebook's container, with one cell root under the pointer. */
function setup(session = enterNotebookComposer(buildNotebook())) {
  render(
    <div>
      <div data-notebook-cell-key="cell-summary">
        <span data-testid="cell-content">Checkout is slow</span>
      </div>
      <ComposerOverlay session={session} belowStickyControls />
    </div>
  );
  const overlay = screen.getByTestId('dashboard-composer-overlay');
  document.elementsFromPoint = () => [overlay, screen.getByTestId('cell-content')];
  return { session, overlay };
}

const live = () => new AbortController().signal;

// D6 on notebooks: pointer moves reach the cells; presses and clicks are Composer's.
describe('notebook Composer overlay pass-through', () => {
  function listenOnCell() {
    const content = screen.getByTestId('cell-content');
    const seen = { pointermove: jest.fn(), pointerdown: jest.fn(), mousedown: jest.fn(), click: jest.fn() };
    for (const [type, listener] of Object.entries(seen)) {
      content.addEventListener(type, listener);
    }
    return { content, seen };
  }

  it('lets pointer moves reach the cell, and picks it on a click that never reaches it', async () => {
    const { session } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(live());
    });
    const { content, seen } = listenOnCell();

    fireEvent.pointerMove(content, { clientX: 400, clientY: 350 });
    const pressed = fireEvent.pointerDown(content, { clientX: 400, clientY: 350, button: 0 });
    const moused = fireEvent.mouseDown(content, { clientX: 400, clientY: 350, button: 0 });
    fireEvent.pointerUp(content, { clientX: 400, clientY: 350 });
    fireEvent.click(content, { clientX: 400, clientY: 350, metaKey: true });

    await expect(pick).resolves.toMatchObject({ ref: { kind: 'cell', name: 'summary' }, additive: true });
    expect(seen.pointermove).toHaveBeenCalledTimes(1);
    expect(pressed).toBe(false);
    expect(moused).toBe(false);
    expect(seen.pointerdown).not.toHaveBeenCalled();
    expect(seen.mousedown).not.toHaveBeenCalled();
    expect(seen.click).not.toHaveBeenCalled();
  });
});

describe('notebook Composer overlay', () => {
  it('picks the cell under the pointer by its element name and label', async () => {
    const { session, overlay } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(live());
    });

    fireEvent.pointerDown(overlay, { clientX: 400, clientY: 350, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 400, clientY: 350 });
    fireEvent.click(overlay, { clientX: 400, clientY: 350 });

    await expect(pick).resolves.toEqual({
      ref: { kind: 'cell', name: 'summary' },
      additive: false,
      label: 'Checkout is slow',
      tabPath: [],
      point: { x: 0.5, y: 0.5 },
    });
  });

  it('shows the block hint over a cell', async () => {
    const { session, overlay } = setup();
    act(() => {
      session.pickElement(live());
    });

    fireEvent.pointerMove(overlay, { clientX: 400, clientY: 350 });
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(
      'Click to comment on a cell, or drag to draw a region'
    );
  });

  it('resolves cells inside the route only, never a copy the canvas draws', () => {
    const { session, overlay } = setup();
    const canvasCopy = document.createElement('div');
    canvasCopy.setAttribute('data-notebook-cell-key', 'cell-summary');
    document.body.prepend(canvasCopy);
    cleanups.push(() => canvasCopy.remove());

    const root = session.findElementRoot({ kind: 'cell', name: 'summary' });

    expect(root).not.toBe(canvasCopy);
    expect(overlay.parentElement!.parentElement!.contains(root)).toBe(true);
    expect(session.findElementRoot({ kind: 'cell', name: 'missing' })).toBeNull();
  });

  it('draws a region over cells, lists them, and captures it from the smallest root holding it', async () => {
    jest
      .mocked(renderNode)
      .mockReset()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
        { width: 1200, height: 600 } as HTMLCanvasElement
      );
    const webp = new Blob(['webp'], { type: 'image/webp' });
    jest.mocked(cropToBlob).mockReset().mockResolvedValue(webp);
    jest.mocked(releaseCanvas).mockReset();
    const { session, overlay } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(live());
    });

    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const region = (await pick) as { ref: { regionId: string }; intersects: unknown; tabPath: string[] };

    expect(region.intersects).toEqual([{ ref: { kind: 'cell', name: 'summary' }, label: 'Checkout is slow' }]);
    expect(region.tabPath).toEqual([]);

    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(region.ref.regionId, live());
    });

    expect(result).toEqual({ status: 'ready', image: webp, width: 400, height: 400, capturedAt: expect.any(String) });
    // The region lies inside the cell, so only the cell is rendered.
    const cellRoot = overlay.parentElement!.parentElement!.querySelector('[data-notebook-cell-key]');
    expect(jest.mocked(renderNode).mock.calls[0][0]).toBe(cellRoot);
  });

  it('pins a comment to a cell', () => {
    const { session } = setup();

    act(() =>
      session.setAnnotations([
        { id: 'c1', ref: { kind: 'cell', name: 'summary' }, point: { x: 1, y: 0 }, label: '1', state: 'active' },
      ])
    );

    expect(screen.getByRole('button', { name: 'Comment 1' })).toBeInTheDocument();
    expect(session.getAnnotationAnchor('c1')).not.toBeNull();
  });
});

describe('notebook rendering in Composer', () => {
  it('marks each cell for hit-testing and mounts the overlay where its route draws it', async () => {
    const scene = buildNotebook();
    enterNotebookComposer(scene);

    render(<scene.Component model={scene} />);

    expect(document.querySelector('[data-notebook-cell-key="cell-summary"]')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-composer-overlay')).toBeInTheDocument();
  });

  it('never mounts the overlay where a host such as the Assistant canvas draws the same scene', () => {
    const scene = buildNotebook();
    enterNotebookComposer(scene);

    render(
      <NotebookEmbeddedHost>
        <scene.Component model={scene} />
      </NotebookEmbeddedHost>
    );

    expect(document.querySelector('[data-notebook-cell-key="cell-summary"]')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-composer-overlay')).not.toBeInTheDocument();
  });

  it('removes the overlay when Composer ends', () => {
    const scene = buildNotebook();
    const session = enterNotebookComposer(scene);
    render(<scene.Component model={scene} />);

    act(() => {
      session.exit();
    });

    expect(screen.queryByTestId('dashboard-composer-overlay')).not.toBeInTheDocument();
  });
});

// Composer is a mode, not a layout: the user may dock the extension sidebar next to the notebook and stay in it.
describe('notebook Composer with the extension sidebar docked', () => {
  it('keeps the session open, and still picks and captures, without the docked sidebar', async () => {
    buildNotebook();
    const entered = await composerApi.enter({ resource: 'notebook', uid: 'nb-overlay' });
    expect(sidebarPresentation()).toBe('floating');
    setExtensionSidebarPresentation('docked');
    expect(entered.signal.aborted).toBe(false);
    expect(sidebarPresentation()).toBe('docked');
    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-extension-sidebar', '');
    document.body.appendChild(sidebar);
    cleanups.push(() => sidebar.remove());
    jest
      .mocked(renderNode)
      .mockReset()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
        { width: 1200, height: 600 } as HTMLCanvasElement
      );
    jest
      .mocked(cropToBlob)
      .mockReset()
      .mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the notebook session the API entered
    const { session, overlay } = setup(entered as unknown as ReturnType<typeof enterNotebookComposer>);

    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickElement(live());
    });
    fireEvent.click(overlay, { clientX: 400, clientY: 350 });
    await expect(pick).resolves.toMatchObject({ ref: { kind: 'cell', name: 'summary' } });

    act(() => {
      pick = session.pickRegion(live());
    });
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const region = (await pick) as { ref: { regionId: string } };
    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(region.ref.regionId, live());
    });

    expect(result).toMatchObject({ status: 'ready' });
    expect(jest.mocked(renderNode).mock.calls[0][1].filter(sidebar)).toBe(false);
    await act(async () => {
      session.exit();
    });
  });
});

/** The declarations of the class rules on `element` (jsdom does not compute stacking). */
function stylesFor(element: Element) {
  const selectors = new Set(Array.from(element.classList, (className) => `.${className}`));
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && selectors.has(rule.selectorText))
    .map((rule) => rule.style.cssText)
    .join('\n');
}

describe('notebook Composer with the floating Assistant', () => {
  let sidebar: HTMLElement;

  beforeEach(() => {
    sidebar = document.createElement('div');
    sidebar.setAttribute('data-extension-sidebar', '');
    document.body.appendChild(sidebar);
  });

  afterEach(() => sidebar.remove());

  it('stacks the overlay inside the notebook, so the Assistant above it stays above its pins and outlines', () => {
    const scene = buildNotebook();
    enterNotebookComposer(scene);

    render(<scene.Component model={scene} />);

    const container = screen.getByTestId('dashboard-composer-overlay').parentElement!.parentElement!;
    expect(stylesFor(container)).toContain('isolation: isolate');
  });

  it('never starts a pick or a region from a press inside the Assistant', async () => {
    const { session, overlay } = setup();
    let settled = false;
    act(() => {
      void session.pickElement(live()).then(() => (settled = true));
    });

    fireEvent.pointerDown(overlay, { clientX: 700, clientY: 600, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 200, clientY: 250 });
    expect(screen.queryByTestId('composer-region-draft')).not.toBeInTheDocument();
    fireEvent.pointerUp(overlay, { clientX: 200, clientY: 250 });
    fireEvent.click(overlay, { clientX: 700, clientY: 600 });
    await act(() => Promise.resolve());

    expect(settled).toBe(false);
  });

  it('lets a drag run on under the Assistant, and captures the notebook there without it', async () => {
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
    const { session, overlay } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(live());
    });

    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 800, clientY: 700 });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const { ref } = (await pick) as { ref: { kind: 'region'; regionId: string } };
    // The full rectangle, reaching under the Assistant at (600, 500).
    expect(session.resolveBox(ref, overlay.parentElement!.getBoundingClientRect())).toEqual({
      left: 150,
      top: 250,
      width: 650,
      height: 450,
    });

    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(ref.regionId, live());
    });
    expect(result).toMatchObject({ status: 'ready' });
    const [root, { filter }] = jest.mocked(renderNode).mock.calls[0];
    // The region runs past the cell, so the notebook's container is rendered, without the Assistant.
    expect(root).toBe(overlay.parentElement!.parentElement);
    expect(filter(sidebar)).toBe(false);
    expect(filter(screen.getByTestId('cell-content'))).toBe(true);
  });

  it("captures a region over the page's background, not transparent", async () => {
    jest
      .mocked(renderNode)
      .mockReset()
      .mockResolvedValue(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the size is read
        { width: 1200, height: 600 } as HTMLCanvasElement
      );
    jest
      .mocked(cropToBlob)
      .mockReset()
      .mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    // The page paints the background; the notebook and its cells paint none.
    document.body.style.backgroundColor = 'rgb(9, 11, 15)';
    cleanups.push(() => document.body.style.removeProperty('background-color'));
    const { session, overlay } = setup();
    let pick: Promise<unknown> = Promise.resolve();
    act(() => {
      pick = session.pickRegion(live());
    });
    fireEvent.pointerDown(overlay, { clientX: 150, clientY: 250, button: 0 });
    fireEvent.pointerUp(overlay, { clientX: 350, clientY: 450 });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the drag above resolves a region
    const region = (await pick) as { ref: { regionId: string } };

    let result: unknown;
    await act(async () => {
      result = await session.captureRegion(region.ref.regionId, live());
    });

    expect(result).toMatchObject({ status: 'ready' });
    expect(jest.mocked(renderNode).mock.calls[0][1].backgroundColor).toBe('rgb(9, 11, 15)');
  });
});
