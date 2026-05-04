import { PanelPlugin } from '@grafana/data';

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

const PANEL_KEY = 'panel-1';
const PLUGIN_ID = 'my-canvas-panel';

function setSceneContextWithPanel(panelKey: string, pluginId: string) {
  // Minimal duck-typed shape that PanelScreenshotServiceImpl's findPluginIdByKey
  // walks: a state with key + pluginId.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__grafanaSceneContext = {
    state: {
      body: {
        state: {
          key: panelKey,
          pluginId,
        },
      },
    },
  };
}

function mountPanelElement(panelKey: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-viz-panel-key', panelKey);
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

  it('returns the override Blob without invoking html-to-image when the plugin handler resolves to a Blob', async () => {
    mountPanelElement(PANEL_KEY);
    setSceneContextWithPanel(PANEL_KEY, PLUGIN_ID);

    const overrideBlob = new Blob(['override'], { type: 'image/png' });
    const onScreenshot = jest.fn().mockResolvedValue(overrideBlob);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const result = await service.capture(PANEL_KEY);

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

  it('falls through to the html-to-image path when the plugin handler resolves to null', async () => {
    mountPanelElement(PANEL_KEY);
    setSceneContextWithPanel(PANEL_KEY, PLUGIN_ID);

    const onScreenshot = jest.fn().mockResolvedValue(null);
    syncGetPanelPluginMock.mockReturnValue(makePluginWithOnScreenshot(onScreenshot));

    const fallbackBlob = new Blob(['fallback'], { type: 'image/png' });
    htmlToImageToBlobMock.mockResolvedValue(fallbackBlob);

    const result = await service.capture(PANEL_KEY);

    expect(onScreenshot).toHaveBeenCalledTimes(1);
    expect(htmlToImageToBlobMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(fallbackBlob);
  });

  it('throws "Panel not in DOM" when no element matches the panelKey', async () => {
    // Intentionally do NOT mount a panel element.

    await expect(service.capture('missing-panel-key')).rejects.toThrow(/^Panel not in DOM/);
    expect(htmlToImageToBlobMock).not.toHaveBeenCalled();
  });
});
