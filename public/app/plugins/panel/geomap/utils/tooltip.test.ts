import { Feature, MapBrowserEvent } from 'ol';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import VectorSource from 'ol/source/Vector';

import { DataFrame, PanelProps } from '@grafana/data';

import { GeomapPanel } from '../GeomapPanel';
import { GeomapHoverPayload, GeomapLayerHover } from '../event';
import { Options } from '../types';

import { pointerMoveListener } from './tooltip';

// Mock the GeomapPanel class
jest.mock('../GeomapPanel', () => {
  return {
    GeomapPanel: jest.fn().mockImplementation(() => {
      return {
        map: {
          getEventPixel: jest.fn().mockReturnValue([100, 100]),
          getCoordinateFromPixel: jest.fn().mockReturnValue([0, 0]),
          forEachFeatureAtPixel: jest.fn(),
        },
        mapDiv: {
          style: { cursor: 'auto' },
        },
        state: {
          measureMenuActive: false,
          ttipOpen: false,
          ttip: undefined,
        },
        hoverPayload: {} as GeomapHoverPayload,
        hoverEvent: {},
        props: {
          eventBus: {
            publish: jest.fn(),
          },
        },
        setState: jest.fn(),
        layers: [],
      };
    }),
  };
});

// Mock the getMapLayerState function
jest.mock('./layers', () => {
  return {
    getMapLayerState: jest.fn().mockReturnValue({
      options: { tooltip: true },
      mouseEvents: { next: jest.fn() },
    }),
  };
});

describe('tooltip utils', () => {
  let panel: GeomapPanel;
  let mockEvent: MapBrowserEvent<MouseEvent>;
  let mockFeature: Feature;
  let mockWebGLLayer: WebGLPointsLayer<VectorSource<Point>>;
  let mockVectorSource: VectorSource<Point>;
  let mockOtherFeature: Feature;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock objects
    panel = new GeomapPanel({} as PanelProps<Options>);
    mockEvent = {
      originalEvent: {
        pageX: 100,
        pageY: 100,
      },
    } as MapBrowserEvent<MouseEvent>;

    // Create mock features
    mockFeature = new Feature({
      geometry: new Point([0, 0]),
      rowIndex: 1,
      frame: {} as DataFrame,
    });

    mockOtherFeature = new Feature({
      geometry: new Point([0, 0]),
      rowIndex: 2,
      frame: {} as DataFrame,
    });

    // Create mock vector source
    mockVectorSource = new VectorSource<Point>();
    mockVectorSource.forEachFeature = jest.fn();

    // Create mock WebGL layer
    mockWebGLLayer = new WebGLPointsLayer({
      source: mockVectorSource,
      style: {
        symbol: {
          symbolType: 'circle',
          size: 8,
          color: '#000000',
          opacity: 1,
        },
      },
    });
    mockWebGLLayer.getSource = jest.fn().mockReturnValue(mockVectorSource);

    // Setup the forEachFeatureAtPixel mock
    if (panel.map) {
      (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
        callback(mockFeature, mockWebGLLayer, null);
      });
    }
  });

  describe('WebGLPointsLayer condition', () => {
    it('should add additional features at the same coordinates for WebGLPointsLayer', () => {
      // Setup the mock vector source to return multiple features at the same coordinates
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(mockOtherFeature);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that forEachFeatureAtPixel was called
      if (panel.map) {
        expect(panel.map.forEachFeatureAtPixel).toHaveBeenCalled();
      }

      // Verify that the layer was added to hoverPayload
      expect(panel.hoverPayload.layers).toBeDefined();
      expect(panel.hoverPayload.layers?.length).toBe(1);

      // Verify that both features were added to the layer
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(2);
      expect(layerHover.features).toContain(mockFeature);
      expect(layerHover.features).toContain(mockOtherFeature);
    });

    it('should not add features with different coordinates', () => {
      // Create a feature with different coordinates
      const differentFeature = new Feature({
        geometry: new Point([1, 1]),
        rowIndex: 3,
        frame: {} as DataFrame,
      });

      // Setup the mock vector source to return a feature with different coordinates
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(differentFeature);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that only the original feature was added
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(1);
      expect(layerHover.features).toContain(mockFeature);
      expect(layerHover.features).not.toContain(differentFeature);
    });

    it('should not add the same feature twice', () => {
      // Setup the mock vector source to return the same feature
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(mockFeature);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that the feature was only added once
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(1);
      expect(layerHover.features).toContain(mockFeature);
    });
  });
});
