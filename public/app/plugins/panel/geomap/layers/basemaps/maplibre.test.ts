import type OpenLayersMap from 'ol/Map';
import LayerGroup from 'ol/layer/Group';

import { type EventBus, type GrafanaTheme2, type MapLayerOptions } from '@grafana/data';

// ol-mapbox-style is untransformed ESM under jest and only its side effect (apply) matters here.
const applyMock = jest.fn().mockResolvedValue(undefined);
jest.mock('ol-mapbox-style', () => ({
  apply: (...args: unknown[]) => applyMock(...args),
}));

import { maplibreLayers } from './maplibre';

const [maplibreLayer] = maplibreLayers;

const DEFAULT_STYLE_URL = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';

const map = {} as OpenLayersMap;
const eventBus = {} as EventBus;
const theme = { isDark: false } as GrafanaTheme2;

async function initLayer(options: Partial<MapLayerOptions>): Promise<LayerGroup> {
  const handler = await maplibreLayer.create(
    map,
    { name: 'maplibre', type: 'maplibre', config: {}, ...options } as MapLayerOptions,
    eventBus,
    theme
  );
  return handler.init() as LayerGroup;
}

describe('maplibre basemap', () => {
  beforeEach(() => {
    applyMock.mockClear();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ layers: [] }),
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a LayerGroup and defaults opacity to 1', async () => {
    const layer = await initLayer({});
    expect(layer).toBeInstanceOf(LayerGroup);
    expect(layer.getOpacity()).toBe(1);
  });

  it('applies the configured layer opacity to the group', async () => {
    const layer = await initLayer({ opacity: 0.4 });
    expect(layer.getOpacity()).toBe(0.4);
  });

  it('fetches the default style URL when no config url is set', async () => {
    await initLayer({ config: {} });
    expect(fetch).toHaveBeenCalledWith(DEFAULT_STYLE_URL);
  });

  it('fetches the configured style URL when one is provided', async () => {
    const url = 'https://tiles.example.com/style.json';
    await initLayer({ config: { url } });
    expect(fetch).toHaveBeenCalledWith(url);
  });
});
