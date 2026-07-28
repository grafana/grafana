import { getPanelScreenshotService } from '@grafana/runtime';

import { capturePanelScreenshot } from './capturePanelScreenshot';

jest.mock('@grafana/runtime', () => ({
  getPanelScreenshotService: jest.fn(),
}));

const getServiceMock = jest.mocked(getPanelScreenshotService);

/** The 8-byte PNG signature followed by a marker, so the encoded output is recognisable. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41]);

function mockCapture(impl: () => Promise<Blob>) {
  const capture = jest.fn(impl);
  getServiceMock.mockReturnValue({ capture });
  return capture;
}

/** Puts a panel element in the DOM with a rect that is inside, or outside, the viewport. */
function mountPanel(panelPathId: string, { inViewport }: { inViewport: boolean }) {
  const el = document.createElement('div');
  el.setAttribute('data-viz-panel-id', panelPathId);
  document.body.appendChild(el);
  const top = inViewport ? 10 : window.innerHeight + 500;
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + 300, left: 0, right: 400, width: 400, height: 300, x: 0, y: top }) as DOMRect;
  return el;
}

describe('capturePanelScreenshot', () => {
  const onError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    mountPanel('panel-1', { inViewport: true });
    mountPanel('web-1$panel-3', { inViewport: true });
  });

  it('returns the PNG as base64 without the data-URL prefix', async () => {
    mockCapture(async () => new Blob([PNG_BYTES], { type: 'image/png' }));

    const result = await capturePanelScreenshot('panel-1', onError);

    // The backend base64-decodes this field directly, so a `data:` prefix would corrupt panel.png.
    expect(result).toBe(Buffer.from(PNG_BYTES).toString('base64'));
    expect(result).not.toContain('data:');
    expect(onError).not.toHaveBeenCalled();
  });

  it('requests a PNG for the given panelPathId', async () => {
    const capture = mockCapture(async () => new Blob([PNG_BYTES], { type: 'image/png' }));

    await capturePanelScreenshot('web-1$panel-3', onError);

    // The path id is opaque and must be passed through unchanged — it disambiguates repeat instances.
    expect(capture).toHaveBeenCalledWith('web-1$panel-3', { format: 'png' });
  });

  it('reports the failure and resolves undefined when capture throws', async () => {
    mockCapture(async () => {
      throw new Error('Panel not in DOM');
    });

    const result = await capturePanelScreenshot('panel-1', onError);

    // Best-effort: the caller must be able to ship the bundle without panel.png.
    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Panel not in DOM' }));
  });

  it('reports the failure and resolves undefined when the service is unavailable', async () => {
    // @ts-expect-error deliberately modelling a context that never ran the app bootstrap
    getServiceMock.mockReturnValue(undefined);

    const result = await capturePanelScreenshot('panel-1', onError);

    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('not available') })
    );
  });

  it('gives up rather than hanging when the renderer never settles', async () => {
    // The renderer has no timeout of its own and its cost scales with document size, so a capture that
    // never settles must not stall the download the user is waiting on.
    jest.useFakeTimers();
    mockCapture(() => new Promise<Blob>(() => {}));

    const pending = capturePanelScreenshot('panel-1', onError);
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('timed out') }));
    jest.useRealTimers();
  });

  it('refuses to capture a panel scrolled out of the viewport', async () => {
    // Off-screen panels are still mounted (LazyLoader mode="query"), but their queries may not have
    // run — so capturing would produce an empty panel the user never actually saw.
    document.body.innerHTML = '';
    mountPanel('panel-9', { inViewport: false });
    const capture = mockCapture(async () => new Blob([PNG_BYTES], { type: 'image/png' }));

    const result = await capturePanelScreenshot('panel-9', onError);

    expect(result).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('scrolled out of the viewport') })
    );
  });
});
