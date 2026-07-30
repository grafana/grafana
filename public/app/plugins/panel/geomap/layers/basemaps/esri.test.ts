import type OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { type EventBus, type GrafanaTheme2, type MapLayerHandler, type MapLayerOptions } from '@grafana/data';

import { getTileSource } from '../test-utils';

import { esriLayers, type ESRIXYZConfig } from './esri';

// The generic XYZ layer interpolates the URL via getTemplateSrv().replace()
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v?: string) => v ?? '' }),
}));

const [esriXYZ] = esriLayers;

const map = {} as OpenLayersMap;
const eventBus = {} as EventBus;
const theme = { isDark: false } as GrafanaTheme2;

function createHandler(config: ESRIXYZConfig): Promise<MapLayerHandler> {
  const options: MapLayerOptions<ESRIXYZConfig> = { name: 'esri', type: 'esri-xyz', config };
  return esriXYZ.create(map, options, eventBus, theme);
}

async function initSource(config: ESRIXYZConfig): Promise<XYZ> {
  const handler = await createHandler(config);
  return getTileSource(handler.init(), XYZ);
}

const ARCGIS = 'https://services.arcgisonline.com/ArcGIS/rest/services/';

describe('esri (ArcGIS MapServer) basemap', () => {
  it('defaults to the World Street Map service when no server is set', async () => {
    const source = await initSource({});
    expect(source.getUrls()?.[0]).toBe(`${ARCGIS}World_Street_Map/MapServer/tile/{z}/{y}/{x}`);
  });

  it.each([
    ['streets', 'World_Street_Map'],
    ['world-imagery', 'World_Imagery'],
    ['topo', 'World_Topo_Map'],
    ['ocean', 'Ocean/World_Ocean_Base'],
  ])('maps the "%s" service to its ArcGIS slug URL', async (server, slug) => {
    const source = await initSource({ server });
    expect(source.getUrls()?.[0]).toBe(`${ARCGIS}${slug}/MapServer/tile/{z}/{y}/{x}`);
  });

  it('uses the caller-supplied url unchanged for a custom server', async () => {
    const url = 'https://tiles.example.com/{z}/{x}/{y}.png';
    const source = await initSource({ server: 'custom', url });
    expect(source.getUrls()?.[0]).toBe(url);
  });

  it('returns a TileLayer backed by an XYZ source', async () => {
    const handler = await createHandler({ server: 'streets' });
    const layer = handler.init();
    expect(layer).toBeInstanceOf(TileLayer);
    expect(getTileSource(layer, XYZ)).toBeInstanceOf(XYZ);
  });
});
