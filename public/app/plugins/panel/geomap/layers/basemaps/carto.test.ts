import type OpenLayersMap from 'ol/Map';
import type LayerGroup from 'ol/layer/Group';
import Layer from 'ol/layer/Layer';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { type EventBus, type GrafanaTheme2, type MapLayerOptions } from '@grafana/data';

// ol-mapbox-style is untransformed ESM under jest and only its side effect (apply) matters here.
const applyMock = jest.fn().mockResolvedValue(undefined);
jest.mock('ol-mapbox-style', () => ({
  apply: (...args: unknown[]) => applyMock(...args),
}));

import { carto, type CartoConfig, LayerTheme } from './carto';

const POSITRON = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_MATTER = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const map = {} as OpenLayersMap;
const eventBus = {} as EventBus;
const lightTheme = { isDark: false } as GrafanaTheme2;
const darkTheme = { isDark: true } as GrafanaTheme2;

async function createLayer(config: CartoConfig, theme = lightTheme) {
  const options: MapLayerOptions<CartoConfig> = { name: 'carto', type: 'carto', config };
  const handler = await carto.create(map, options, eventBus, theme);
  return handler.init() as LayerGroup;
}

async function initLayer(config: CartoConfig, theme = lightTheme) {
  const layer = await createLayer(config, theme);
  // The mocked fetch never touches the network, so a timer drains the whole promise chain
  await new Promise((resolve) => setTimeout(resolve, 0));
  return layer;
}

/** Every attribution the group's sources would hand to the OpenLayers attribution control */
function attributionsOf(group: LayerGroup): string[] {
  return group
    .getLayers()
    .getArray()
    .flatMap((child) => {
      const attributions = child instanceof Layer ? child.getSource()?.getAttributions() : null;
      // OpenLayers normalises a string into a function of the frame state, which a static value ignores
      return attributions ? [attributions(null!)].flat() : [];
    });
}

describe('CARTO basemap', () => {
  beforeEach(() => {
    applyMock.mockClear();
    // CARTO really does serve every style with the same id, and a Response body is read only once
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 'voyager' })));
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    { desc: 'light', theme: LayerTheme.Light, labels: true, style: POSITRON },
    { desc: 'dark', theme: LayerTheme.Dark, labels: true, style: DARK_MATTER },
    { desc: 'auto', theme: LayerTheme.Auto, labels: true, grafana: darkTheme, style: DARK_MATTER },
    {
      desc: 'no labels',
      theme: LayerTheme.Light,
      labels: false,
      style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
    },
  ])('loads the $desc vector style', async ({ theme, labels, grafana, style }) => {
    await initLayer({ theme, showLabels: labels }, grafana);
    expect(fetch).toHaveBeenCalledWith(style);
  });

  // ol-mapbox-style caches paint functions per style id, so leaving CARTO's shared 'voyager' id in
  // place makes the first basemap on the page repaint every later one.
  it('gives each style a distinct id', async () => {
    await initLayer({ theme: LayerTheme.Light });
    await initLayer({ theme: LayerTheme.Dark });

    expect(applyMock.mock.calls[0][1].id).toBe(POSITRON);
    expect(applyMock.mock.calls[1][1].id).toBe(DARK_MATTER);
  });

  describe('attribution', () => {
    // The style's attribution is two chained requests away, so without carrying our own the credit
    // the raster source always showed is missing on first render and absent entirely offline.
    it('is present before the style request resolves', async () => {
      const layer = await createLayer({ theme: LayerTheme.Light });

      expect(attributionsOf(layer)).toEqual([expect.stringContaining('©CARTO')]);
    });

    it('does not double up once the style credits the same projects', async () => {
      // ol-mapbox-style appends its own layers, attributed from the TileJSON it fetches
      applyMock.mockImplementationOnce(async (group: LayerGroup) => {
        const fromTileJson = '&copy; <a href="https://carto.com/about-carto/">CARTO</a>';
        group.getLayers().push(new VectorLayer({ source: new VectorSource({ attributions: fromTileJson }) }));
      });

      const layer = await initLayer({ theme: LayerTheme.Light });

      expect(attributionsOf(layer)).toEqual([expect.stringContaining('©CARTO')]);
    });
  });
});
