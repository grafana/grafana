import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import { EventBus, MapLayerOptions, GrafanaTheme2 } from '@grafana/data';

import { standard } from './osm';

describe('OSM layer noRepeat functionality', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = {} as GrafanaTheme2;
  });

  it('should set wrapX to false when noRepeat is true', async () => {
    const options: MapLayerOptions = {
      name: 'Test OSM Layer',
      type: 'osm-standard',
      noRepeat: true,
    };

    const result = await standard.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<OSM>).getSource() as OSM;
    expect(source).toBeInstanceOf(OSM);
    expect(source.getWrapX()).toBe(false);
  });

  it('should set wrapX to true when noRepeat is false', async () => {
    const options: MapLayerOptions = {
      name: 'Test OSM Layer',
      type: 'osm-standard',
      noRepeat: false,
    };

    const result = await standard.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<OSM>).getSource() as OSM;
    expect(source).toBeInstanceOf(OSM);
    expect(source.getWrapX()).toBe(true);
  });

  it('should set wrapX to true when noRepeat is undefined (defaults to false)', async () => {
    const options: MapLayerOptions = {
      name: 'Test OSM Layer',
      type: 'osm-standard',
      // noRepeat not specified
    };

    const result = await standard.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<OSM>).getSource() as OSM;
    expect(source).toBeInstanceOf(OSM);
    expect(source.getWrapX()).toBe(true);
  });
});
