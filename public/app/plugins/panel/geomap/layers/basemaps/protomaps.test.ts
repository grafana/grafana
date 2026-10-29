import type OpenLayersMap from 'ol/Map';
import type VectorTileLayer from 'ol/layer/VectorTile';
import type VectorTileSource from 'ol/source/VectorTile';

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

import { PMTilesVectorSource } from './pmtilesSource';
import { protomaps, ProtomapsFlavor, type ProtomapsConfig, TileDelivery } from './protomaps';

const map = {} as OpenLayersMap;
const eventBus = {} as EventBus;
const lightTheme = { isDark: false } as GrafanaTheme2;
const darkTheme = { isDark: true } as GrafanaTheme2;

/** Trimmed from a generated Protomaps style: one fill, six labels, one border, four roads */
const STYLE = {
  version: 8,
  sources: { protomaps: { type: 'vector' } },
  layers: [
    { id: 'earth', type: 'fill', source: 'protomaps', 'source-layer': 'earth' },
    {
      id: 'earth_label_islands',
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
    {
      id: 'roads_highway',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      paint: {
        'line-color': '#ebebeb',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, 0, 6, 1.1, 12, 1.6, 15, 5, 18, 15],
      },
    },
    {
      id: 'roads_major',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      paint: { 'line-color': '#292929' },
    },
    { id: 'roads_minor_service', type: 'line', source: 'protomaps', 'source-layer': 'roads' },
    { id: 'roads_tunnels_major', type: 'line', source: 'protomaps', 'source-layer': 'roads' },
    {
      id: 'boundaries_country',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'boundaries',
      paint: {
        'line-color': '#adadad',
        'line-width': 0.7,
        'line-dasharray': ['step', ['zoom'], ['literal', [2, 0]], 4, ['literal', [2, 1]]],
      },
    },
    {
      id: 'places_region',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'places',
      layout: {
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 7, 16],
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': '#b3b3b3', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    },
    {
      id: 'places_locality',
      type: 'symbol',
      source: 'protomaps',
      'source-layer': 'places',
      layout: { 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
    },
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
    { desc: 'white for auto in a light theme', flavor: ProtomapsFlavor.Auto, theme: lightTheme, file: 'white' },
    { desc: 'black for auto in a dark theme', flavor: ProtomapsFlavor.Auto, theme: darkTheme, file: 'black' },
    { desc: 'an explicit flavor regardless of theme', flavor: ProtomapsFlavor.Light, theme: darkTheme, file: 'light' },
  ])('loads $desc', async ({ flavor, theme, file }) => {
    await initLayer({ flavor }, theme);

    expect(fetch).toHaveBeenCalledWith(`http://localhost:8095/styles/${file}.json`);
  });

  it('reads tiles from the PMTiles archive by default', async () => {
    const layer = await createLayer({});

    const source = layer.getSource();
    expect(source).toBeInstanceOf(PMTilesVectorSource);
    expect((source as PMTilesVectorSource).getArchiveUrl()).toBe('http://localhost:8095/planet.pmtiles');
  });

  // On a live map the source changes for other reasons before the archive request settles
  it('still warns when the source changed while the archive was loading', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) =>
        String(input).endsWith('.json')
          ? new Response(JSON.stringify(STYLE))
          : new Response('', { status: 404, statusText: 'Not Found' })
      );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const layer = await createLayer({});
    layer.getSource()!.changed();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith(
      'Failed to load Protomaps basemap archive from http://localhost:8095/planet.pmtiles:',
      new Error('Bad response code: 404')
    );
  });

  it('warns with the cause when the PMTiles archive cannot be opened', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) =>
        String(input).endsWith('.json')
          ? new Response(JSON.stringify(STYLE))
          : new Response('', { status: 404, statusText: 'Not Found' })
      );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const layer = await initLayer({});

    expect(layer.getSource()?.getState()).toBe('error');
    expect(warn).toHaveBeenCalledWith(
      'Failed to load Protomaps basemap archive from http://localhost:8095/planet.pmtiles:',
      new Error('Bad response code: 404')
    );
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
      style: 'https://tiles.example.com/basemap/v1/styles/white.json',
    },
    {
      desc: 'falls back to the dev server for a non-http URL',
      server: 'javascript:alert(1)',
      style: 'http://localhost:8095/styles/white.json',
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
      styleUrl: 'http://localhost:8095/styles/white.json',
    });
  });

  it('draws labels in Grafana’s own Inter instead of Noto Sans', async () => {
    await initLayer({ showLabels: true });

    expect(appliedLayer('earth_label_islands').layout['text-font']).toEqual([
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

  it('keeps labels as quiet as the default basemap’s, so they stay under the panel’s data', async () => {
    await initLayer({ flavor: ProtomapsFlavor.Light, showLabels: true });

    const minorRoads = appliedLayer('roads_labels_minor');
    const pois = appliedLayer('pois');
    expect(minorRoads.layout['text-size']).toBe(9);
    expect(pois.layout).toEqual({
      'text-font': ['Inter SemiBold'],
      'text-transform': 'uppercase',
      'text-size': ['interpolate', ['linear'], ['zoom'], 15, 8, 17, 9, 18, 10],
    });
    expect(pois.paint).toEqual({ 'text-color': '#525252', 'text-halo-color': '#1f1f1f', 'text-halo-width': 1 });
  });

  it('draws region names in the default basemap’s size and weight, without a halo', async () => {
    await initLayer({ flavor: ProtomapsFlavor.Light, showLabels: true });

    const region = appliedStyle().layers.find((layer: { id: string }) => layer.id === 'places_region');
    expect(region.layout).toEqual({
      'text-font': ['Inter SemiBold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 7, 14],
      'text-transform': 'uppercase',
      'text-max-width': 9,
    });
    expect(region.paint).toEqual({ 'text-color': '#b3b3b3', 'text-halo-color': '#ffffff', 'text-halo-width': 0 });
  });

  it('sizes cities, towns and villages by the default basemap’s place classes rather than by population', async () => {
    await initLayer({ showLabels: true });

    const locality = appliedStyle().layers.find((layer: { id: string }) => layer.id === 'places_locality');
    const [interpolate, linear, zoom, , dotSize, firstLabelZoom, firstLabelSizes] = locality.layout['text-size'];
    expect([interpolate, linear, zoom]).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(dotSize).toEqual(expect.arrayContaining(['major_city', 12, 'city', 12]));
    expect(firstLabelZoom).toBe(8);
    expect(firstLabelSizes).toEqual([
      'match',
      [
        'case',
        ['==', ['get', 'kind_detail'], 'city'],
        ['case', ['<=', ['coalesce', ['get', 'min_zoom'], 0], 6], 'major_city', 'city'],
        ['get', 'kind_detail'],
      ],
      'major_city',
      14,
      'city',
      12,
      'town',
      10,
      'village',
      9,
      8,
    ]);
  });

  it('uppercases capitals from zoom 7, cities from zoom 8 and hamlets from zoom 14, like the default basemap', async () => {
    await initLayer({ showLabels: true });

    const [step, zoom, further, ...stops] = appliedLayer('places_locality').layout['text-transform'];
    expect([step, zoom, further]).toEqual(['step', ['zoom'], 'none']);
    expect(stops.filter((_: unknown, i: number) => i % 2 === 0)).toEqual([7, 8, 14]);
    expect(stops[3]).toEqual(['match', ['get', 'kind_detail'], 'city', 'uppercase', 'none']);
  });

  it('leaves out house numbers, which the default basemap never shows', async () => {
    await initLayer({ showLabels: true });

    expect(appliedStyle().layers.map((layer: { id: string }) => layer.id)).not.toContain('address_label');
  });

  it('drops label layers when labels are off', async () => {
    await initLayer({ showLabels: false });

    expect(appliedStyle().layers.map((layer: { id: string }) => layer.id)).toEqual([
      'earth',
      'roads_highway',
      'roads_major',
      'roads_minor_service',
      'roads_tunnels_major',
      'boundaries_country',
    ]);
  });

  it.each([
    { flavor: ProtomapsFlavor.White, land: '#fafaf8', border: '#f2e6e7' },
    { flavor: ProtomapsFlavor.Black, land: '#0e0e0e', border: '#5c5e5e' },
  ])('paints $flavor in the colors of the default basemap it stands in for', async ({ flavor, land, border }) => {
    await initLayer({ flavor, showLabels: true });

    const layers = appliedStyle().layers;
    const layer = (id: string) => layers.find((candidate: { id: string }) => candidate.id === id);
    expect(layer('earth').paint).toEqual({ 'fill-color': land });
    const borders = layer('boundaries_country').paint;
    expect(borders['line-color'].slice(0, 5)).toEqual(['interpolate', ['linear'], ['zoom'], 4, border]);
    // The default basemap draws country borders solid
    expect(borders).not.toHaveProperty('line-dasharray');
  });

  it('draws highways as thin and light as the default basemap’s further out, where they would compete with data', async () => {
    await initLayer({ flavor: ProtomapsFlavor.White });

    const highway = appliedStyle().layers.find((layer: { id: string }) => layer.id === 'roads_highway');
    expect(highway.paint['line-color']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      '#e6e6e6',
      12,
      '#dddddd',
      15,
      '#ffffff',
    ]);
    // Under a pixel until zoom 8, then Protomaps' own widths from zoom 12
    expect(highway.paint['line-width']).toEqual([
      'interpolate',
      ['exponential', 1.6],
      ['zoom'],
      ...[3, 0, 6, 0.5, 7, 0.7, 8, 0.8, 10, 1.3, 12, 1.6, 15, 5, 18, 15],
    ]);
  });

  it('draws secondary roads in the dark default basemap’s blue-grey at every zoom, unlike primary roads', async () => {
    await initLayer({ flavor: ProtomapsFlavor.Black });

    const major = appliedStyle().layers.find((layer: { id: string }) => layer.id === 'roads_major');
    const bySecondary = (primary: string) => [
      'match',
      ['get', 'kind_detail'],
      ['secondary', 'tertiary', 'secondary_link', 'tertiary_link'],
      '#414758',
      primary,
    ];
    expect(major.paint['line-color']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      ...[5, bySecondary('#1a1a1a'), 12, bySecondary('#232323'), 15, bySecondary('#535666')],
    ]);
  });

  it('draws tunnels in the default basemap’s flat colors, and the dark default basemap’s service roads darker than the land', async () => {
    await initLayer({ flavor: ProtomapsFlavor.Black });

    const layer = (id: string) => appliedStyle().layers.find((candidate: { id: string }) => candidate.id === id);
    expect(layer('roads_tunnels_major').paint['line-color']).toEqual([
      'match',
      ['get', 'kind_detail'],
      ['secondary', 'tertiary', 'secondary_link', 'tertiary_link'],
      '#161616',
      '#414758',
    ]);
    expect(layer('roads_minor_service').paint['line-color']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      ...[5, '#1c1c1c', 12, '#1c1c1c', 15, '#0b0b0b'],
    ]);
  });

  it('paints only colors, leaving which labels show and from which zoom as they were', async () => {
    await initLayer({ flavor: ProtomapsFlavor.White, showLabels: true });
    const white = appliedStyle().layers;
    applyStyleMock.mockClear();
    await initLayer({ flavor: ProtomapsFlavor.Light, showLabels: true });
    const light = appliedStyle().layers;

    const placement = ({ id, minzoom, filter, layout }: Record<string, unknown>) => ({ id, minzoom, filter, layout });
    expect(white.map(placement)).toEqual(light.map(placement));
  });

  it('leaves the other flavors in their generated colors', async () => {
    await initLayer({ flavor: ProtomapsFlavor.Light, showLabels: true });

    expect(appliedLayer('earth').paint).toBeUndefined();
    expect(appliedLayer('boundaries_country').paint['line-color']).toBe('#adadad');
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
      'Failed to load Protomaps basemap style from http://localhost:8095/styles/white.json:',
      new Error('404 Not Found')
    );
    expect(layer.getStyle()).toBeNull();
  });
});
