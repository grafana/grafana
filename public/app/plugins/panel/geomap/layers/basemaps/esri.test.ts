import OpenLayersMap from 'ol/Map';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import ImageArcGISRest from 'ol/source/ImageArcGISRest';
import XYZ from 'ol/source/XYZ';

import { EventBus, GrafanaTheme2, MapLayerOptions, PanelData } from '@grafana/data';

import { esriXYZTiles, ESRIXYZConfig } from './esri';

describe('ArcGIS MapServer layer', () => {
  let mockMap: OpenLayersMap;
  let mockEventBus: EventBus;
  let mockTheme: GrafanaTheme2;

  beforeEach(() => {
    mockMap = {} as OpenLayersMap;
    mockEventBus = {} as EventBus;
    mockTheme = {} as GrafanaTheme2;
  });

  describe('Custom MapServer (tiled)', () => {
    it('should create a TileLayer with XYZ source for tiled service', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Tiled Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom',
          url: 'https://example.com/arcgis/rest/services/MyService/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Test Attribution',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();

      expect(layer).toBeInstanceOf(TileLayer);
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
      expect(source).toBeInstanceOf(XYZ);
    });

    it('should support refresh on update for tiled service', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Tiled Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom',
          url: 'https://example.com/tile/{z}/{y}/{x}',
          attribution: 'Test',
          refreshOnUpdate: true,
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

      const refreshSpy = jest.spyOn(source, 'refresh');
      result.update?.({} as PanelData);

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not refresh when refreshOnUpdate is false', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Tiled Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom',
          url: 'https://example.com/tile/{z}/{y}/{x}',
          attribution: 'Test',
          refreshOnUpdate: false,
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;

      const refreshSpy = jest.spyOn(source, 'refresh');
      result.update?.({} as PanelData);

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('Custom Dynamic MapServer', () => {
    it('should create an ImageLayer with ImageArcGISRest source for dynamic service', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Dynamic Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom-dynamic',
          url: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer',
          attribution: 'NOAA',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();

      expect(layer).toBeInstanceOf(ImageLayer);
      const source = (layer as ImageLayer<ImageArcGISRest>).getSource() as ImageArcGISRest;
      expect(source).toBeInstanceOf(ImageArcGISRest);
    });

    it('should strip /tile/{z}/{y}/{x} from dynamic service URL', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Dynamic Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom-dynamic',
          url: 'https://example.com/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Test',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as ImageLayer<ImageArcGISRest>).getSource() as ImageArcGISRest;

      // URL should be cleaned up
      expect(source).toBeInstanceOf(ImageArcGISRest);
    });

    it('should always refresh dynamic service on update', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Dynamic Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom-dynamic',
          url: 'https://example.com/MapServer',
          attribution: 'Test',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();
      const source = (layer as ImageLayer<ImageArcGISRest>).getSource() as ImageArcGISRest;

      const refreshSpy = jest.spyOn(source!, 'refresh');
      result.update?.({} as PanelData);

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should handle empty URL gracefully', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Dynamic Layer',
        type: 'esri-xyz',
        config: {
          server: 'custom-dynamic',
          url: '',
          attribution: 'Test',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();

      expect(layer).toBeInstanceOf(ImageLayer);
      const source = (layer as ImageLayer<ImageArcGISRest>).getSource();
      expect(source).toBeNull();
    });
  });

  describe('Built-in services', () => {
    it('should configure URL for built-in World Street Map service', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test Built-in Layer',
        type: 'esri-xyz',
        config: {
          server: 'streets',
          url: '',
          attribution: '',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();

      expect(layer).toBeInstanceOf(TileLayer);
      const source = (layer as TileLayer<XYZ>).getSource() as XYZ;
      expect(source).toBeInstanceOf(XYZ);
    });

    it('should use tiled layer for built-in services', async () => {
      const options: MapLayerOptions<ESRIXYZConfig> = {
        name: 'Test World Imagery',
        type: 'esri-xyz',
        config: {
          server: 'world-imagery',
          url: '',
          attribution: '',
        },
      };

      const result = await esriXYZTiles.create(mockMap, options, mockEventBus, mockTheme);
      const layer = result.init();

      expect(layer).toBeInstanceOf(TileLayer);
      expect(layer).not.toBeInstanceOf(ImageLayer);
    });
  });
});
