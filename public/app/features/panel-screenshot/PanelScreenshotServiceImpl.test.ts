import type { PanelPlugin } from '@grafana/data';

import { syncGetPanelPlugin } from '../plugins/importPanelPlugin';

import { PanelScreenshotServiceImpl } from './PanelScreenshotServiceImpl';

jest.mock('../plugins/importPanelPlugin', () => ({
  syncGetPanelPlugin: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const htmlToImageToBlobMock = jest.fn();
jest.mock(
  'html-to-image',
  () => ({
    toBlob: (...args: unknown[]) => htmlToImageToBlobMock(...args),
  }),
  { virtual: true }
);

const syncGetPanelPluginMock = jest.mocked(syncGetPanelPlugin);

const PANEL_PATH_ID = 'eu$panel-1';
const PLUGIN_ID = 'my-canvas-panel';

function makeSceneContext(panelPathId: string, pluginId: string) {
  // Minimal duck-typed shape that satisfies @grafana/scenes' `isSceneObject`
  // (presence of `useState`) AND the walker downstream (a child node with
  // `getPathId()` + `state.pluginId`).
  return {
    useState: () => ({}),
    state: {
      body: {
        getPathId: () => panelPathId,
        state: {
          pluginId,
        },
      },
    },
  };
}

function mountPanelElement(panelPathId: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-viz-panel-id', panelPathId);
  document.body.appendChild(el);
  return el;
}

function makePluginWithOnScreenshot(handler: PanelPlugin['onScreenshot']): PanelPlugin {
  // Avoid going through the full PanelPlugin constructor: we only need the
  // `meta.id` and `onScreenshot` fields the service touches.
  return {
    meta: { id: PLUGIN_ID },
    onScreenshot: handler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('PanelScreenshotServiceImpl', () => {
  let service: PanelScreenshotServiceImpl;

  beforeEach(() => {
    service = new PanelScreenshotServiceImpl();
    htmlToImageToBlobMock.mockReset();
    syncGetPanelPluginMock.mockReset();
    document.body.innerHTML = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__grafanaSceneContext;
  });

  it('returns the override Blob without invoking html-to-image when plugin handler resolves to a Blob (explicit sceneContext)', async () => {
    mountPanelElement(PANEL_PATH_ID);
    const sceneContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);

    const overrideBlob = new Blob(['override'], { type: 'image/png' });
    const onScreenshot = jest.fn().mockResolvedValue(overrideBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const result = await service.capture(PANEL_PATH_ID, { sceneContext });

    expect(result).toBe(overrideBlob);
    expect(onScreenshot).toHaveBeenCalledTimes(1);
    expect(onScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        element: expect.any(HTMLElement),
        format: 'png',
      })
    );
    expect(htmlToImageToBlobMock).not.toHaveBeenCalled();
  });

  it('falls through to the html-to-image path when the plugin handler resolves to null (explicit sceneContext)', async () => {
    mountPanelElement(PANEL_PATH_ID);
    const sceneContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);

    const onScreenshot = jest.fn().mockResolvedValue(null);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const fallbackBlob = new Blob(['fallback'], { type: 'image/png' });
    htmlToImageToBlobMock.mockResolvedValue(fallbackBlob);

    const result = await service.capture(PANEL_PATH_ID, { sceneContext });

    expect(onScreenshot).toHaveBeenCalledTimes(1);
    expect(htmlToImageToBlobMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(fallbackBlob);
  });

  it('throws "Panel not in DOM" when no element matches the panelPathId', async () => {
    // Intentionally do NOT mount a panel element.
    await expect(service.capture('missing-panel-path-id')).rejects.toThrow(/^Panel not in DOM/);
    expect(htmlToImageToBlobMock).not.toHaveBeenCalled();
  });

  it('uses global window.__grafanaSceneContext as fallback when sceneContext is not in options', async () => {
    mountPanelElement(PANEL_PATH_ID);
    // Set the global — this is the back-compat path exercised by callers that
    // don't pass sceneContext explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__grafanaSceneContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);

    const overrideBlob = new Blob(['global-fallback'], { type: 'image/png' });
    const onScreenshot = jest.fn().mockResolvedValue(overrideBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const result = await service.capture(PANEL_PATH_ID);

    expect(result).toBe(overrideBlob);
    expect(onScreenshot).toHaveBeenCalledTimes(1);
  });

  it('explicit sceneContext takes priority over window.__grafanaSceneContext', async () => {
    mountPanelElement(PANEL_PATH_ID);
    // Set a global with a different panel — it should be ignored.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__grafanaSceneContext = makeSceneContext('other-panel', 'other-plugin');

    const explicitContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);
    const overrideBlob = new Blob(['explicit'], { type: 'image/png' });
    const onScreenshot = jest.fn().mockResolvedValue(overrideBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const result = await service.capture(PANEL_PATH_ID, { sceneContext: explicitContext });

    expect(result).toBe(overrideBlob);
    expect(onScreenshot).toHaveBeenCalledTimes(1);
  });

  it('falls back to html-to-image when neither sceneContext option nor global is set', async () => {
    mountPanelElement(PANEL_PATH_ID);

    const fallbackBlob = new Blob(['no-scene'], { type: 'image/png' });
    htmlToImageToBlobMock.mockResolvedValue(fallbackBlob);

    const result = await service.capture(PANEL_PATH_ID);

    expect(syncGetPanelPluginMock).not.toHaveBeenCalled();
    expect(htmlToImageToBlobMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(fallbackBlob);
  });

  it('warns when override blob MIME does not match requested format and still returns the blob', async () => {
    mountPanelElement(PANEL_PATH_ID);
    const sceneContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);

    const wrongTypeBlob = new Blob(['override'], { type: 'image/png' });
    const onScreenshot = jest.fn().mockResolvedValue(wrongTypeBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await service.capture(PANEL_PATH_ID, { sceneContext, format: 'jpeg' });
      expect(result).toBe(wrongTypeBlob);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/returned image\/png but image\/jpeg was requested/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn when override blob has empty MIME', async () => {
    mountPanelElement(PANEL_PATH_ID);
    const sceneContext = makeSceneContext(PANEL_PATH_ID, PLUGIN_ID);

    const emptyTypeBlob = new Blob(['override']);
    const onScreenshot = jest.fn().mockResolvedValue(emptyTypeBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await service.capture(PANEL_PATH_ID, { sceneContext, format: 'jpeg' });
      expect(result).toBe(emptyTypeBlob);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it.each([
    ['string', 'not a scene'],
    ['number', 42],
    ['plain object without state', { foo: 'bar' }],
    ['object with non-object state', { state: 'not-an-object' }],
    ['null', null],
    ['array', [1, 2, 3]],
  ])('throws when sceneContext is %s', async (_label, badValue) => {
    mountPanelElement(PANEL_PATH_ID);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.capture(PANEL_PATH_ID, { sceneContext: badValue as any })
    ).rejects.toThrow(/sceneContext must be a SceneObject/);

    expect(syncGetPanelPluginMock).not.toHaveBeenCalled();
    expect(htmlToImageToBlobMock).not.toHaveBeenCalled();
  });
});
