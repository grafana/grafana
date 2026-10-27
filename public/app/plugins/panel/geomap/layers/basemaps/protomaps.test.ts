import type OpenLayersMap from 'ol/Map';
import type VectorTileLayer from 'ol/layer/VectorTile';
import type VectorTileSource from 'ol/source/VectorTile';
import { type PMTilesVectorSource } from 'ol-pmtiles';

import { type EventBus, type GrafanaTheme2, type MapLayerOptions } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

// ol-mapbox-style is untransformed ESM under jest and only its side effects matter here.
const applyStyleMock = jest.fn().mockResolvedValue(undefined);
const applyBackgroundMock = jest.fn().mockResolvedValue(undefined);
jest.mock('ol-mapbox-style', () => ({
  applyStyle: (...args: unknown[]) => applyStyleMock(...args),
  applyBackground: (...args: unknown[]) => applyBackgroundMock(...args),
}));

import { protomaps, ProtomapsFlavor, type ProtomapsConfig, TileDelivery } from './protomaps';

const map = {} as OpenLayersMap;
const eventBus = {} as EventBus;
const lightTheme = { isDark: false } as GrafanaTheme2;
const darkTheme = { isDark: true } as GrafanaTheme2;

/** Trimmed from a generated Protomaps style: one fill, four labels */
const STYLE = {
  version: 8,
  sources: { protomaps: { type: 'vector' } },
  layers: [
    { id: 'earth', type: 'fill', source: 'protomaps', 'source-layer': 'earth' },
    {
      id: 'places_locality',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'places',
      layout: {
        'text-font': ['step', ['zoom'], ['literal', ['Noto Sans Regular']], 8, ['literal', ['Noto Sans Medium']]],
      },
    },
    {
      id: 'roads_labels_minor',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'roads',
      minzoom: 15,
      filter: ['in', 'kind', 'minor_road', 'other', 'path'],
      layout: { 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-color': '#525252', 'text-halo-color': '#1f1f1f', 'text-halo-width': 1 },
    },
    {
      id: 'pois',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'pois',
      filter: [
        'all',
        ['in', ['get', 'kind'], ['literal', ['park', 'restaurant', 'museum', 'stadium']]],
        ['>=', ['zoom'], ['+', ['get', 'min_zoom'], 0]],
      ],
      layout: {
        'icon-image': ['get', 'kind'],
        'text-font': ['Noto Sans Regular'],
        'text-offset': [1.1, 0],
        'text-variable-anchor': ['left', 'right'],
      },
      paint: { 'text-color': '#30C573', 'text-halo-color': '#1f1f1f', 'text-halo-width': 1 },
    },
    { id: 'address_label', type: 'symbol', source: 'protomaps', 'source-layer': 'buildings', minzoom: 18 },
  ],
};

async function createLayer(config: ProtomapsConfig, theme = lightTheme) {
  const options: MapLayerOptions<ProtomapsConfig> = { name: 'protomaps', type: 'protomaps', config };
  const handler = await protomaps.create(map, options, eventBus, theme);
  return handler.init() as VectorTileLayer;
}

async function initLayer(config: ProtomapsConfig, theme = lightTheme) {
  const layer = await createLayer(config, theme);
  // The mocked fetch never touches the network, so a timer drains the whole promise chain
  await new Promise((resolve) => setTimeout(resolve, 0));
  return layer;
}

function appliedStyle() {
  return applyStyleMock.mock.calls[0][1];
}

function appliedLayer(id: string) {
  return appliedStyle().layers.find((layer: { id: string }) => layer.id === id);
}

describe('Protomaps basemap', () => {
  afterAll(() => setTestFlags({}));

  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaGeomapProtomapsBasemap]: true });
    applyStyleMock.mockClear();
    applyBackgroundMock.mockClear();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('.json')
        ? new Response(JSON.stringify(STYLE))
        : // The PMTiles header request: left pending, the source simply stays loading
          new Promise(() => {})
    );
  });

  afterEach(() => jest.restoreAllMocks());

  // A saved panel can still name this layer after the flag is turned off
  it('refuses to create the layer while its flag is off', async () => {
    setTestFlags({ [FlagKeys.GrafanaGeomapProtomapsBasemap]: false });

    await expect(createLayer({})).rejects.toThrow(
      'The Protomaps basemap needs the grafana.geomapProtomapsBasemap feature flag'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { desc: 'light for auto in a light theme', flavor: ProtomapsFlavor.Auto, theme: lightTheme, file: 'light' },
    { desc: 'dark for auto in a dark theme', flavor: ProtomapsFlavor.Auto, theme: darkTheme, file: 'dark' },
    { desc: 'an explicit flavor regardless of theme', flavor: ProtomapsFlavor.White, theme: darkTheme, file: 'white' },
  ])('loads $desc', async ({ flavor, theme, file }) => {
    await initLayer({ flavor }, theme);

    expect(fetch).toHaveBeenCalledWith(`http://localhost:8095/styles/${file}.json`);
  });

  it('reads tiles from the PMTiles archive by default', async () => {
    const layer = await createLayer({});

    const source = layer.getSource() as PMTilesVectorSource;
    expect(source.pmtiles_.source.getKey()).toBe('http://localhost:8095/planet.pmtiles');
  });

  it('requests one URL per tile for ZXY delivery', async () => {
    const layer = await createLayer({ delivery: TileDelivery.ZXY });

    const source = layer.getSource() as VectorTileSource;
    expect(source.getUrls()).toEqual(['http://localhost:8095/tiles/{z}/{x}/{y}.mvt']);
  });

  it.each([
    {
      desc: 'keeps a path prefix on the configured server',
      server: 'https://tiles.example.com/basemap/v1',
      style: 'https://tiles.example.com/basemap/v1/styles/light.json',
    },
    {
      desc: 'falls back to the dev server for a non-http URL',
      server: 'javascript:alert(1)',
      style: 'http://localhost:8095/styles/light.json',
    },
  ])('$desc', async ({ server, style }) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await initLayer({ server });

    expect(fetch).toHaveBeenCalledWith(style);
  });

  // ol-mapbox-style would otherwise replace the PMTiles source with one built from the style's own
  it('styles the source it was given rather than one from the style', async () => {
    await initLayer({});

    expect(applyStyleMock.mock.calls[0][2]).toEqual({
      source: 'protomaps',
      updateSource: false,
      styleUrl: 'http://localhost:8095/styles/light.json',
    });
  });

  it('draws labels in Grafana’s own Inter instead of Noto Sans', async () => {
    await initLayer({ showLabels: true });

    expect(appliedLayer('places_locality').layout['text-font']).toEqual([
      'step',
      ['zoom'],
      ['literal', ['Inter Regular']],
      8,
      ['literal', ['Inter Medium']],
    ]);
  });

  it('names minor roads from zoom 16 instead of 15, and leaves paths and other roads unnamed', async () => {
    await initLayer({ showLabels: true });

    expect(appliedLayer('roads_labels_minor')).toMatchObject({
      minzoom: 16,
      filter: ['==', ['get', 'kind'], 'minor_road'],
    });
  });

  it('labels only the places the default basemap labels, from zoom 15', async () => {
    await initLayer({ showLabels: true });

    expect(appliedLayer('pois')).toMatchObject({
      minzoom: 15,
      filter: [
        'all',
        [
          'all',
          ['in', ['get', 'kind'], ['literal', ['park', 'restaurant', 'museum', 'stadium']]],
          ['>=', ['zoom'], ['+', ['get', 'min_zoom'], 0]],
        ],
        [
          'all',
          ['in', ['get', 'kind'], ['literal', ['park', 'stadium', 'attraction']]],
          ['any', ['==', ['get', 'kind'], 'park'], ['<=', ['coalesce', ['get', 'min_zoom'], 0], 13]],
        ],
      ],
    });
  });

  it('leaves out house numbers, which the default basemap never shows', async () => {
    await initLayer({ showLabels: true });

    expect(appliedStyle().layers.map((layer: { id: string }) => layer.id)).not.toContain('address_label');
  });

  it('drops label layers when labels are off', async () => {
    await initLayer({ showLabels: false });

    expect(appliedStyle().layers.map((layer: { id: string }) => layer.id)).toEqual(['earth']);
  });

  it('credits OpenStreetMap before the style request resolves', async () => {
    const layer = await createLayer({});

    const attributions = layer.getSource()?.getAttributions();
    // OpenLayers normalises a string into a function of the frame state, which a static value ignores
    expect(attributions?.(null!)).toEqual([expect.stringContaining('©OpenStreetMap')]);
  });

  it('leaves the layer unstyled when the style request fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) =>
        String(input).endsWith('.json')
          ? new Response('', { status: 404, statusText: 'Not Found' })
          : new Promise(() => {})
      );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const layer = await initLayer({});

    expect(warn).toHaveBeenCalledWith(
      'Failed to load Protomaps basemap style from http://localhost:8095/styles/light.json:',
      new Error('404 Not Found')
    );
    expect(layer.getStyle()).toBeNull();
  });
});
