import { act, fireEvent, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { ComposerOverlay } from 'app/features/dashboard-scene/composer/ComposerOverlay';
import { cropToBlob, releaseCanvas, renderNode } from 'app/features/dashboard-scene/composer/raster';

import { NOTEBOOKS_FLAG } from '../mutation-api/test-utils';
import { NotebookEmbeddedHost } from '../scene/NotebookEmbeddedContext';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { enterNotebookComposer } from './NotebookComposerDocument';
import { setRouteNotebook } from './notebookComposerAccess';

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
const originalElementsFromPoint = document.elementsFromPoint;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  setTestFlags({ [NOTEBOOKS_FLAG]: true, 'grafana.notebookComposer': true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.hasAttribute('data-notebook-cell-key') ? CELL_RECT : CONTENT_RECT;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured rect without toJSON
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.elementsFromPoint = originalElementsFromPoint;
  jest.restoreAllMocks();
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
function setup() {
  const scene = buildNotebook();
  const session = enterNotebookComposer(scene);
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
  return { scene, session, overlay };
}

const live = () => new AbortController().signal;

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
      'Click to comment on a block, or drag to draw a region'
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
