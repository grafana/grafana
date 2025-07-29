import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { EventBus, GrafanaTheme2, MapLayerOptions } from '@grafana/data';

import { carto, CartoConfig, LayerTheme } from './carto';

describe('CARTO basemap layer noRepeat functionality', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = { isDark: false } as GrafanaTheme2;
  });

  it('should set wrapX to false when noRepeat is true', async () => {
    const options: MapLayerOptions<CartoConfig> = {
      name: 'Test CARTO Layer',
      type: 'carto',
      config: {
        theme: LayerTheme.Light,
        showLabels: true,
      },
      noRepeat: true,
    };

    const result = await carto.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(false);
  });

  it('should set wrapX to true when noRepeat is false', async () => {
    const options: MapLayerOptions<CartoConfig> = {
      name: 'Test CARTO Layer',
      type: 'carto',
      config: {
        theme: LayerTheme.Dark,
        showLabels: false,
      },
      noRepeat: false,
    };

    const result = await carto.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(true);
  });

  it('should set wrapX to true when noRepeat is undefined (defaults to false)', async () => {
    const options: MapLayerOptions<CartoConfig> = {
      name: 'Test CARTO Layer',
      type: 'carto',
      config: {
        theme: LayerTheme.Auto,
        showLabels: true,
      },
      // noRepeat not specified
    };

    const result = await carto.create(mockMap, options, mockEventBus, mockTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source).toBeInstanceOf(XYZ);
    expect(source.getWrapX()).toBe(true);
  });

  it('should preserve theme and label settings when noRepeat is set', async () => {
    const mockDarkTheme = { isDark: true } as GrafanaTheme2;
    const options: MapLayerOptions<CartoConfig> = {
      name: 'Test CARTO Layer',
      type: 'carto',
      config: {
        theme: LayerTheme.Auto, // Should use dark theme from mockDarkTheme
        showLabels: false,
      },
      noRepeat: true,
    };

    const result = await carto.create(mockMap, options, mockEventBus, mockDarkTheme);
    const layer = result.init();

    expect(layer).toBeInstanceOf(TileLayer);
    const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
    expect(source.getWrapX()).toBe(false);

    // Check that the URL reflects the dark theme without labels
    const urls = source.getUrls();
    expect(urls?.[0]).toContain('dark_nolabels');
  });
});
