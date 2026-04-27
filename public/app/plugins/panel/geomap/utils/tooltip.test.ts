import Feature from 'ol/Feature';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import VectorSource from 'ol/source/Vector';

import { DataHoverClearEvent, type PanelProps } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';

import { GeomapPanel } from '../GeomapPanel';
import { type GeomapHoverPayload, type GeomapLayerHover } from '../event';
import { type Options } from '../panelcfg.gen';

import { pointerMoveListener, setTooltipListeners } from './tooltip';

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
  let mockEvent: MapBrowserEvent<PointerEvent>;
  let mockWebGLLayer: WebGLPointsLayer<VectorSource<Feature<Point>>>;
  let mockVectorSource: VectorSource<Feature<Point>>;

  // Consolidated feature constants
  let feature1: Feature;
  let feature2: Feature;
  let feature3: Feature;
  let feature4: Feature;
  let differentFeature: Feature;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock objects
    panel = new GeomapPanel({} as PanelProps<Options>);

    // Create a proper MouseEvent instance to pass the instanceof check
    const mouseEvent = new MouseEvent('pointermove');
    Object.defineProperty(mouseEvent, 'pageX', { value: 100 });
    Object.defineProperty(mouseEvent, 'pageY', { value: 100 });

    mockEvent = {
      originalEvent: mouseEvent,
    } as MapBrowserEvent<PointerEvent>;

    // Create features for testing
    feature1 = new Feature({
      geometry: new Point([0, 0]),
      rowIndex: 1,
      frame: {} as DataFrame,
    });

    feature2 = new Feature({
      geometry: new Point([0, 0]),
      rowIndex: 2,
      frame: {} as DataFrame,
    });

    feature3 = new Feature({
      geometry: new Point([0, 0]),
      rowIndex: 3,
      frame: {} as DataFrame,
    });

    feature4 = new Feature({
      geometry: new Point([0, 0]),
      // No rowIndex
      frame: {} as DataFrame,
    });

    differentFeature = new Feature({
      geometry: new Point([1, 1]),
      rowIndex: 4,
      frame: {} as DataFrame,
    });

    // Create mock vector source
    mockVectorSource = new VectorSource<Feature<Point>>();
    mockVectorSource.forEachFeature = jest.fn();

    // Create mock WebGL layer
    mockWebGLLayer = new WebGLPointsLayer({
      source: mockVectorSource,
      style: {
        'circle-radius': 8,
        'circle-fill-color': '#000000',
        'circle-opacity': 1,
      },
    });
    mockWebGLLayer.getSource = jest.fn().mockReturnValue(mockVectorSource);

    // Setup the forEachFeatureAtPixel mock
    if (panel.map) {
      (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
        callback(feature1, mockWebGLLayer, null);
      });
    }
  });

  describe('WebGLPointsLayer condition', () => {
    it('should add additional features at the same coordinates for WebGLPointsLayer', () => {
      // Setup the mock vector source to return multiple features at the same coordinates
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(feature2);
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
      expect(layerHover.features).toContain(feature1);
      expect(layerHover.features).toContain(feature2);
    });

    it('should not add features with different coordinates', () => {
      // Setup the mock vector source to return a feature with different coordinates
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(differentFeature);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that only the original feature was added
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(1);
      expect(layerHover.features).toContain(feature1);
      expect(layerHover.features).not.toContain(differentFeature);
    });

    it('should not add the same feature twice', () => {
      // Setup the mock vector source to return the same feature
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(feature1);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that the feature was only added once
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(1);
      expect(layerHover.features).toContain(feature1);
    });

    it('should sort features by rowIndex when multiple features are at the same coordinates', () => {
      // Setup the mock vector source to return multiple features
      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(feature2);
        callback(feature3);
        callback(feature4);
      });

      // Call the function
      pointerMoveListener(mockEvent, panel);

      // Verify that the features were added and sorted by rowIndex
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(4); // feature1 + 3 new features

      // Check that features are sorted by rowIndex (1, 2, 3, MAX_SAFE_INTEGER)
      // Since rowIndex is unique, we can check the exact order
      expect(layerHover.features[0].getProperties()['rowIndex']).toBe(1); // feature1
      expect(layerHover.features[1].getProperties()['rowIndex']).toBe(2); // feature2
      expect(layerHover.features[2].getProperties()['rowIndex']).toBe(3); // feature3
      // The last feature (feature4) has no rowIndex, so it should be at the end
      expect(layerHover.features[3].getProperties()['rowIndex']).toBeUndefined();
    });
  });
});

describe('setTooltipListeners', () => {
  function createPanelForSetListeners(overrides?: { tooltipPointerMoveDebounced?: { cancel: jest.Mock } }) {
    let pointerLeaveHandler: () => void;
    const viewport = {
      addEventListener: jest.fn((type: string, fn: () => void) => {
        if (type === 'pointerleave') {
          pointerLeaveHandler = fn;
        }
      }),
    };
    const publish = jest.fn();
    const clearTooltip = jest.fn();
    const panel = {
      tooltipPointerMoveDebounced: overrides?.tooltipPointerMoveDebounced,
      map: {
        on: jest.fn(),
        getViewport: jest.fn().mockReturnValue(viewport),
      },
      props: { eventBus: { publish } },
      clearTooltip,
    } as unknown as GeomapPanel;

    return {
      panel,
      viewport,
      publish,
      clearTooltip,
      simulateViewportPointerLeave: () => pointerLeaveHandler(),
    };
  }

  it('attaches pointerleave to the map viewport', () => {
    const { panel, viewport } = createPanelForSetListeners();
    setTooltipListeners(panel);
    expect(panel.map?.getViewport).toHaveBeenCalled();
    expect(viewport.addEventListener).toHaveBeenCalledWith('pointerleave', expect.any(Function));
  });

  it('on viewport pointerleave, publishes DataHoverClearEvent and calls clearTooltip', () => {
    const { panel, publish, clearTooltip, simulateViewportPointerLeave } = createPanelForSetListeners();
    setTooltipListeners(panel);
    simulateViewportPointerLeave();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.any(DataHoverClearEvent));
    expect(clearTooltip).toHaveBeenCalledTimes(1);
  });

  it('on viewport pointerleave, cancels the debounced pointermove handler', () => {
    const { panel, simulateViewportPointerLeave } = createPanelForSetListeners();
    setTooltipListeners(panel);

    const debounced = panel.tooltipPointerMoveDebounced;
    expect(debounced).toBeDefined();
    const cancelSpy = jest.spyOn(debounced!, 'cancel');
    simulateViewportPointerLeave();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels any existing debounced handler before replacing listeners', () => {
    const previousCancel = jest.fn();
    const { panel } = createPanelForSetListeners({
      tooltipPointerMoveDebounced: { cancel: previousCancel },
    });
    setTooltipListeners(panel);
    expect(previousCancel).toHaveBeenCalledTimes(1);
  });
});
