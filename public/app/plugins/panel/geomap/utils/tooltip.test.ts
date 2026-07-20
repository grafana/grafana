import Feature from 'ol/Feature';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import Cluster from 'ol/source/Cluster';
import VectorSource from 'ol/source/Vector';

import { DataHoverClearEvent, type DataFrame, type PanelProps } from '@grafana/data';

import { GeomapPanel } from '../GeomapPanel';
import { type GeomapHoverPayload, type GeomapLayerHover } from '../event';
import { type Options } from '../panelcfg.gen';

import { pointerClickListener, pointerMoveListener, setTooltipListeners } from './tooltip';

// Mock the GeomapPanel class
jest.mock('../GeomapPanel', () => {
  return {
    GeomapPanel: jest.fn().mockImplementation(() => {
      return {
        map: {
          getEventPixel: jest.fn().mockReturnValue([100, 100]),
          getCoordinateFromPixel: jest.fn().mockReturnValue([0, 0]),
          getSize: jest.fn().mockReturnValue([800, 600]),
          forEachFeatureAtPixel: jest.fn(),
          getView: jest.fn().mockReturnValue({
            getResolution: jest.fn().mockReturnValue(100), // 100 map units/pixel → tolerance = 100 * 2 = 200 map units
            // Separability inputs for cluster hover/click (only read for multi-member clusters):
            getMaxZoom: jest.fn().mockReturnValue(20),
            getResolutionForZoom: jest.fn().mockReturnValue(0.001), // tiny pixel at max zoom → spread members can separate
            getResolutionForExtent: jest.fn().mockReturnValue(2),
          }),
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

// Cluster expansion and click-to-zoom are gated on the hit layer being backed
// by an ol Cluster source
function makeClusterSourceLayer() {
  const layer = new WebGLPointsLayer({
    source: new VectorSource<Feature<Point>>(),
    style: {
      'circle-radius': 8,
      'circle-fill-color': '#000000',
      'circle-opacity': 1,
    },
  });
  layer.getSource = jest.fn().mockReturnValue(new Cluster({}));
  return layer;
}

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
      geometry: new Point([50000, 50000]), // well outside pixel tolerance
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

    it('should match near-overlapping features within pixel tolerance', () => {
      // Mock resolution: 100 map units/pixel, HIT_TOLERANCE_PX = 2, tolerance = 200 map units
      // Per-axis: |dx| <= 200 && |dy| <= 200
      // Create features with coordinates close to [0,0] but not exactly equal
      // (simulates geocoding/lookup mode floating-point imprecision)
      const nearFeature1 = new Feature({
        geometry: new Point([50, 50]), // |dx| = |dy| = 50, within 200
        rowIndex: 10,
        frame: {} as DataFrame,
      });

      const nearFeature2 = new Feature({
        geometry: new Point([-30, 20]), // |dx| = 30, |dy| = 20, within 200
        rowIndex: 11,
        frame: {} as DataFrame,
      });

      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(nearFeature1);
        callback(nearFeature2);
      });

      pointerMoveListener(mockEvent, panel);

      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(3); // feature1 + 2 near features
      expect(layerHover.features).toContain(feature1);
      expect(layerHover.features).toContain(nearFeature1);
      expect(layerHover.features).toContain(nearFeature2);
    });

    it('should match features exactly at the tolerance boundary (inclusive)', () => {
      // Mock resolution: 100 map units/pixel, HIT_TOLERANCE_PX = 2, tolerance = 200 map units
      // Feature at [200, 0] → |dx| = 200, exactly equal to tolerance → should match (<=)
      const boundaryFeature = new Feature({
        geometry: new Point([200, 0]),
        rowIndex: 15,
        frame: {} as DataFrame,
      });

      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(boundaryFeature);
      });

      pointerMoveListener(mockEvent, panel);

      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(2);
      expect(layerHover.features).toContain(boundaryFeature);
    });

    it('should not match features outside pixel tolerance', () => {
      // Mock resolution: 100 map units/pixel, HIT_TOLERANCE_PX = 2, tolerance = 200 map units
      // Per-axis: |dx| > 200 || |dy| > 200
      const farFeature = new Feature({
        geometry: new Point([500, 500]), // |dx| = |dy| = 500, outside 200
        rowIndex: 20,
        frame: {} as DataFrame,
      });

      (mockVectorSource.forEachFeature as jest.Mock).mockImplementation((callback) => {
        callback(farFeature);
      });

      pointerMoveListener(mockEvent, panel);

      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features.length).toBe(1); // only feature1
      expect(layerHover.features).not.toContain(farFeature);
    });

    it('should show a zoom hint without a tooltip for a separable multi-member cluster', () => {
      // Members far enough apart to pull apart by zooming
      const near = new Feature({ geometry: new Point([0, 0]), rowIndex: 1, frame: {} as DataFrame });
      const far = new Feature({ geometry: new Point([1000, 1000]), rowIndex: 2, frame: {} as DataFrame });
      const cluster = new Feature({ geometry: new Point([500, 500]), features: [near, far] });
      if (panel.map) {
        (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
          callback(cluster, makeClusterSourceLayer(), null);
        });
      }

      const found = pointerMoveListener(mockEvent, panel);

      expect(found).toBe(false);
      expect(panel.hoverPayload.layers).toBeUndefined();
      expect(panel.hoverPayload.data).toBeUndefined();
      expect(mockVectorSource.forEachFeature).not.toHaveBeenCalled();
      // The pointer cursor hints that clicking the cluster zooms in
      expect(panel.mapDiv!.style.cursor).toBe('pointer');
    });

    it('should list the members in a tooltip for a non-separable (co-located) cluster', () => {
      // All members share the same coordinate, so zooming can never separate them
      const cluster = new Feature({
        geometry: new Point([0, 0]),
        features: [feature3, feature1, feature2],
      });
      if (panel.map) {
        (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
          callback(cluster, makeClusterSourceLayer(), null);
        });
      }

      const found = pointerMoveListener(mockEvent, panel);

      expect(found).toBe(true);
      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features).toEqual([feature3, feature1, feature2]);
      // The co-located source scan is skipped for cluster layers
      expect(mockVectorSource.forEachFeature).not.toHaveBeenCalled();
      expect(panel.mapDiv!.style.cursor).toBe('pointer');
    });

    it('should tooltip singleton cluster features as their member marker', () => {
      const singleton = new Feature({
        geometry: new Point([0, 0]),
        features: [feature1],
      });
      if (panel.map) {
        (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
          callback(singleton, makeClusterSourceLayer(), null);
        });
      }

      pointerMoveListener(mockEvent, panel);

      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features).toEqual([feature1]);
      expect(panel.hoverPayload.rowIndex).toBe(1);
      expect(mockVectorSource.forEachFeature).not.toHaveBeenCalled();
    });

    it('should not treat a features array property on a non-cluster layer as cluster members', () => {
      // GeoJSON layers copy arbitrary user property bags onto features, so a
      // data property named 'features' must not be expanded (or sorted, which
      // would throw on plain values)
      const geojsonLike = new Feature({
        geometry: new Point([0, 0]),
        features: ['not', 'cluster', 'members'],
        frame: {} as DataFrame,
        rowIndex: 0,
      });
      if (panel.map) {
        (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) => {
          callback(geojsonLike, mockWebGLLayer, null);
        });
      }

      pointerMoveListener(mockEvent, panel);

      const layerHover = panel.hoverPayload.layers?.[0] as GeomapLayerHover;
      expect(layerHover.features).toEqual([geojsonLike]);
    });
  });
});

describe('pointerClickListener', () => {
  function setupClusterClick(viewOverrides?: {
    resolution?: number;
    maxZoomResolution?: number;
    fitResolution?: number;
    memberCoords?: number[][];
  }) {
    const panel = new GeomapPanel({} as PanelProps<Options>);
    const fit = jest.fn();
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    const coords = viewOverrides?.memberCoords ?? [
      [0, 0],
      [1000, 1000],
    ];
    const members = coords.map(
      (coord, i) => new Feature({ geometry: new Point(coord), rowIndex: i, frame: {} as DataFrame })
    );
    const cluster = new Feature({ geometry: new Point([500, 500]), features: members });
    const clusterLayer = makeClusterSourceLayer();

    if (panel.map) {
      panel.map.getSize = jest.fn().mockReturnValue([800, 600]);
      (panel.map.getView as jest.Mock).mockReturnValue({
        // Current view: zoomed out relative to the fit target by default
        getResolution: jest.fn().mockReturnValue(viewOverrides?.resolution ?? 100),
        getMaxZoom: jest.fn().mockReturnValue(20),
        // Resolution at maxZoom: separability tolerance = this * 2px
        getResolutionForZoom: jest.fn().mockReturnValue(viewOverrides?.maxZoomResolution ?? 0.001),
        // Resolution the member extent would fit at
        getResolutionForExtent: jest.fn().mockReturnValue(viewOverrides?.fitResolution ?? 2),
        fit,
      });
      (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) =>
        callback(cluster, clusterLayer, null)
      );
    }

    const event = {
      pixel: [100, 100],
      preventDefault,
      stopPropagation,
    } as unknown as MapBrowserEvent<PointerEvent>;

    return { panel, fit, preventDefault, stopPropagation, event };
  }

  it('zooms to a cluster extent instead of opening the tooltip when members can separate', () => {
    const { panel, fit, preventDefault, stopPropagation, event } = setupClusterClick();

    pointerClickListener(event, panel);

    expect(fit).toHaveBeenCalledWith([0, 0, 1000, 1000], {
      padding: [50, 50, 50, 50],
      duration: 300,
      maxZoom: 20,
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(panel.setState).not.toHaveBeenCalledWith({ ttipOpen: true });
  });

  it('does not zoom when members cannot separate even at maximum zoom', () => {
    const { panel, fit, event } = setupClusterClick({
      // Members 1000 units apart, but a max-zoom pixel is 1000 units wide
      maxZoomResolution: 1000,
    });

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
  });

  it('does not zoom again when the view is already fitted to the members', () => {
    const { panel, fit, event } = setupClusterClick({
      resolution: 2,
      fitResolution: 2,
    });

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
  });

  it('does not zoom while the measure tool is active', () => {
    const { panel, fit, event } = setupClusterClick();
    Object.assign(panel.state, { measureMenuActive: true });

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
  });

  it('does not zoom when the cluster feature comes from a non-cluster layer', () => {
    const { panel, fit, event } = setupClusterClick();
    const plainLayer = new WebGLPointsLayer({
      source: new VectorSource<Feature<Point>>(),
      style: { 'circle-radius': 8, 'circle-fill-color': '#000000' },
    });
    const impostor = new Feature({
      geometry: new Point([0, 0]),
      features: ['not', 'cluster', 'members'],
    });
    if (panel.map) {
      (panel.map.forEachFeatureAtPixel as jest.Mock).mockImplementation((pixel, callback) =>
        callback(impostor, plainLayer, null)
      );
    }

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
  });

  it('does not zoom when a tooltip is already pinned open', () => {
    const { panel, fit, event } = setupClusterClick();
    Object.assign(panel.state, { ttipOpen: true, ttip: { layers: [{}] } });

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
  });

  it('opens a member-list tooltip instead of zooming for a non-separable cluster', () => {
    // A max-zoom pixel is 1000 units wide, so the 1000-unit member spread can
    // never separate: the click should open the tooltip rather than zoom.
    const { panel, fit } = setupClusterClick({ maxZoomResolution: 1000 });
    const mouseEvent = new MouseEvent('click');
    const event = {
      pixel: [100, 100],
      originalEvent: mouseEvent,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as MapBrowserEvent<PointerEvent>;

    pointerClickListener(event, panel);

    expect(fit).not.toHaveBeenCalled();
    expect(panel.setState).toHaveBeenCalledWith({ ttipOpen: true });
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
