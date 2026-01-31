import OpenLayersMap from 'ol/Map';
import View from 'ol/View';
import { transformExtent } from 'ol/proj';
import { ComponentProps } from 'react';

import { dateTime, EventBusSrv, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { GeomapPanel } from './GeomapPanel';
import { TooltipMode } from './types';

// Mock React components
jest.mock('./GeomapTooltip', () => ({
  GeomapTooltip: () => null,
}));

jest.mock('./GeomapOverlay', () => ({
  GeomapOverlay: () => null,
}));

jest.mock('./components/DebugOverlay', () => ({
  DebugOverlay: () => null,
}));

jest.mock('./components/MeasureOverlay', () => ({
  MeasureOverlay: () => null,
}));

jest.mock('./components/MeasureVectorLayer', () => ({
  MeasureVectorLayer: jest.fn(),
}));

jest.mock('./layers/data/markersLayer', () => ({
  defaultMarkersConfig: {
    type: 'markers',
    name: 'Markers',
  },
}));

jest.mock('./layers/registry', () => ({
  DEFAULT_BASEMAP_CONFIG: {
    type: 'default',
    name: 'Default',
  },
}));

jest.mock('./utils/actions', () => ({
  getActions: jest.fn().mockReturnValue({}),
}));

jest.mock('./utils/getLayersExtent', () => ({
  getLayersExtent: jest.fn().mockReturnValue([0, 0, 100, 100]),
}));

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  config: {
    theme2: {},
  },
  locationService: {
    partial: jest.fn(),
  },
  getTemplateSrv: jest.fn().mockReturnValue({
    containsTemplate: jest.fn().mockReturnValue(false),
    getVariables: jest.fn().mockReturnValue([]),
  }),
}));

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
  },
}));

jest.mock('./utils/utils', () => ({
  updateMap: jest.fn(),
  getNewOpenLayersMap: jest.fn(),
  notifyPanelEditor: jest.fn(),
  hasVariableDependencies: jest.fn().mockReturnValue(false),
  hasLayerData: jest.fn().mockReturnValue(false),
}));

jest.mock('./utils/tooltip', () => ({
  setTooltipListeners: jest.fn(),
  pointerClickListener: jest.fn(),
  pointerMoveListener: jest.fn(),
}));

jest.mock('./utils/layers', () => ({
  initLayer: jest.fn().mockResolvedValue({
    layer: {},
    handler: {},
    options: {},
  }),
  applyLayerFilter: jest.fn(),
}));

jest.mock('./view', () => ({
  centerPointRegistry: {
    getIfExists: jest.fn().mockReturnValue(null),
  },
  MapCenterID: {
    Fit: 'fit',
    Coordinates: 'coords',
  },
}));

jest.mock('ol/proj', () => ({
  fromLonLat: jest.fn((coord) => coord),
  transformExtent: jest.fn((extent) => extent),
}));

jest.mock('./globalStyles', () => ({
  getGlobalStyles: jest.fn().mockReturnValue({}),
}));

jest.mock('ol/interaction/MouseWheelZoom', () => {
  return jest.fn().mockImplementation(() => ({
    setActive: jest.fn(),
  }));
});

jest.mock('ol/View', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    un: jest.fn(),
    calculateExtent: jest.fn(),
    getResolutionForExtent: jest.fn(),
    fit: jest.fn(),
    setResolution: jest.fn(),
    getZoom: jest.fn(),
    setZoom: jest.fn(),
    setCenter: jest.fn(),
    setMaxZoom: jest.fn(),
    setMinZoom: jest.fn(),
  }));
});

// Import after mocks are set up

// Test constants
const MOCK_EXTENT = [100, 200, 300, 400];
const MOCK_EXTENT_4326 = [10, 20, 30, 40];
const DEBOUNCE_TIMEOUT = 500;
const VARIABLE_NAME = 'map_view';

// Helper to create props with dashboard variable enabled
const createPropsWithVariable = (
  baseProps: ComponentProps<typeof GeomapPanel>,
  variableName: string | undefined = VARIABLE_NAME
) => ({
  ...baseProps,
  options: {
    ...baseProps.options,
    view: {
      ...baseProps.options.view,
      dashboardVariable: true,
      dashboardVariableName: variableName,
    },
  },
});

// Helper to create props without dashboard variable
const createPropsWithoutVariable = (baseProps: ComponentProps<typeof GeomapPanel>) => ({
  ...baseProps,
  options: {
    ...baseProps.options,
    view: {
      ...baseProps.options.view,
      dashboardVariable: false,
    },
  },
});

// Helper to create props with debug enabled
const createPropsWithDebug = (baseProps: ComponentProps<typeof GeomapPanel>) => ({
  ...baseProps,
  options: {
    ...baseProps.options,
    view: {
      ...baseProps.options.view,
      dashboardVariable: true,
      dashboardVariableName: VARIABLE_NAME,
    },
    controls: {
      ...baseProps.options.controls,
      showDebug: true,
    },
  },
});

describe('GeomapPanel - View Listener', () => {
  let panel: GeomapPanel;
  let mockView: Partial<jest.Mocked<View>>;
  let mockMap: Partial<jest.Mocked<OpenLayersMap>>;
  let props: ComponentProps<typeof GeomapPanel>;
  let viewOnMock: jest.Mock;
  let viewUnMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Suppress expected React warnings about setState before mount
    jest.spyOn(console, 'error').mockImplementation((message) => {
      if (
        typeof message === 'string' &&
        (message.includes("Can't call setState on a component that is not yet mounted") ||
          message.includes("Can't call %s on a component that is not yet mounted"))
      ) {
        return;
      }
    });

    // Create mock view with event listener methods
    viewOnMock = jest.fn().mockReturnValue({ listener: jest.fn() });
    viewUnMock = jest.fn();

    mockView = {
      on: viewOnMock,
      un: viewUnMock,
      calculateExtent: jest.fn().mockReturnValue([0, 0, 100, 100]),
      getResolutionForExtent: jest.fn().mockReturnValue(1),
      fit: jest.fn(),
      setResolution: jest.fn(),
      getZoom: jest.fn().mockReturnValue(5),
      setZoom: jest.fn(),
      setCenter: jest.fn(),
      setMaxZoom: jest.fn(),
      setMinZoom: jest.fn(),
    };

    mockMap = {
      getView: jest.fn().mockReturnValue(mockView as unknown as View),
      setView: jest.fn(),
      addLayer: jest.fn(),
      addInteraction: jest.fn(),
      getLayers: jest.fn().mockReturnValue({
        forEach: jest.fn(),
      }),
      getControls: jest.fn().mockReturnValue({
        clear: jest.fn(),
      }),
      addControl: jest.fn(),
      getSize: jest.fn().mockReturnValue([800, 600]),
      updateSize: jest.fn(),
      dispose: jest.fn(),
    };

    const { getNewOpenLayersMap } = require('./utils/utils');
    getNewOpenLayersMap.mockReturnValue(mockMap as unknown as OpenLayersMap);

    const now = dateTime();
    props = {
      id: 1,
      data: {
        state: LoadingState.Done,
        series: [],
        timeRange: {
          from: now,
          to: now,
          raw: { from: 'now-1h', to: 'now' },
        },
      },
      title: 'Test Panel',
      transparent: false,
      width: 800,
      height: 600,
      renderCounter: 0,
      options: {
        view: {
          id: 'coords',
          lat: 0,
          lon: 0,
          zoom: 1,
        },
        controls: {
          showZoom: true,
          showAttribution: true,
        },
        basemap: {
          type: 'default',
          name: 'Default',
        },
        layers: [],
        tooltip: {
          mode: TooltipMode.None,
        },
      },
      onOptionsChange: jest.fn(),
      onFieldConfigChange: jest.fn(),
      replaceVariables: jest.fn((str) => str),
      timeRange: {
        from: now,
        to: now,
        raw: { from: 'now-1h', to: 'now' },
      },
      timeZone: 'browser',
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      onChangeTimeRange: jest.fn(),
      eventBus: new EventBusSrv(),
    };

    panel = new GeomapPanel(props);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('View listener registration', () => {
    it('should register view listener when dashboardVariable is enabled', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      expect(viewOnMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not register view listener when dashboardVariable is disabled', async () => {
      panel = new GeomapPanel(createPropsWithoutVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      expect(viewOnMock).not.toHaveBeenCalled();
    });
  });

  describe('View listener cleanup', () => {
    it('should unregister view listener on component unmount', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Verify listener was registered
      expect(viewOnMock).toHaveBeenCalled();
      const registeredKey = viewOnMock.mock.results[0].value;

      // Unmount component
      panel.componentWillUnmount();

      // Verify listener was unregistered
      expect(viewUnMock).toHaveBeenCalledWith('change', registeredKey.listener);
    });

    it('should cleanup existing listener before registering new one during re-initialization', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');

      // First initialization
      await panel.initMapAsync(div);
      expect(viewOnMock).toHaveBeenCalledTimes(1);
      const firstKey = viewOnMock.mock.results[0].value;

      // Second initialization (simulating re-init)
      await panel.initMapAsync(div);

      // Should have unregistered the first listener
      expect(viewUnMock).toHaveBeenCalledWith('change', firstKey.listener);
      // Should have registered a new listener
      expect(viewOnMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateGeoVariables', () => {
    it('should update dashboard variable with transformed extent', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Mock transformExtent to return a specific value
      jest.mocked(transformExtent).mockReturnValue(MOCK_EXTENT_4326);

      // Trigger the view change callback
      const changeCallback = viewOnMock.mock.calls[0][1];
      changeCallback();

      // Fast-forward past debounce timeout
      jest.advanceTimersByTime(DEBOUNCE_TIMEOUT);

      // Verify locationService.partial was called with correct parameters
      expect(locationService.partial).toHaveBeenCalledWith({ [`var-${VARIABLE_NAME}`]: `${MOCK_EXTENT_4326}` }, true);
    });

    it('should debounce multiple rapid view changes', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Trigger multiple rapid changes
      const changeCallback = viewOnMock.mock.calls[0][1];
      changeCallback();
      jest.advanceTimersByTime(200);
      changeCallback();
      jest.advanceTimersByTime(200);
      changeCallback();

      // At this point, locationService.partial should not have been called yet
      expect(locationService.partial).not.toHaveBeenCalled();

      // Fast-forward past the final debounce timeout
      jest.advanceTimersByTime(DEBOUNCE_TIMEOUT);

      // Should have been called only once due to debouncing
      expect(locationService.partial).toHaveBeenCalledTimes(1);
    });

    it('should not update variable if dashboardVariableName is not set', async () => {
      // Create props with dashboardVariable enabled but no variable name
      const propsWithoutVariableName = {
        ...props,
        options: {
          ...props.options,
          view: {
            ...props.options.view,
            dashboardVariable: true,
            dashboardVariableName: undefined,
          },
        },
      };

      panel = new GeomapPanel(propsWithoutVariableName);
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Clear any calls from initialization
      jest.mocked(locationService.partial).mockClear();

      // Trigger the view change callback
      const changeCallback = viewOnMock.mock.calls[0][1];
      changeCallback();

      // Fast-forward past debounce timeout
      jest.advanceTimersByTime(DEBOUNCE_TIMEOUT);

      // Should not have called locationService.partial
      expect(locationService.partial).not.toHaveBeenCalled();
    });

    it('should clear pending timeout on unmount', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Trigger a view change
      const changeCallback = viewOnMock.mock.calls[0][1];
      changeCallback();

      // Unmount before the debounce timeout completes
      jest.advanceTimersByTime(200);
      panel.componentWillUnmount();

      // Fast-forward past the debounce timeout
      jest.advanceTimersByTime(DEBOUNCE_TIMEOUT);

      // locationService.partial should not have been called
      expect(locationService.partial).not.toHaveBeenCalled();
    });
  });

  describe('Debug logging', () => {
    it('should log debug info when showDebug is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      panel = new GeomapPanel(createPropsWithDebug(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      expect(consoleSpy).toHaveBeenCalledWith('Geomap.initMapAsync: register view listener', mockView);

      consoleSpy.mockRestore();
    });
  });

  describe('Integration with view changes', () => {
    it('should handle view extent calculation and transformation correctly', async () => {
      panel = new GeomapPanel(createPropsWithVariable(props));
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      mockView.calculateExtent!.mockReturnValue(MOCK_EXTENT);
      jest.mocked(transformExtent).mockReturnValue(MOCK_EXTENT_4326);

      // Trigger the view change
      const changeCallback = viewOnMock.mock.calls[0][1];
      changeCallback();
      jest.advanceTimersByTime(DEBOUNCE_TIMEOUT);

      // Verify the extent was calculated and transformed
      expect(mockView.calculateExtent).toHaveBeenCalled();
      expect(transformExtent).toHaveBeenCalledWith(MOCK_EXTENT, 'EPSG:3857', 'EPSG:4326');
      expect(locationService.partial).toHaveBeenCalledWith({ [`var-${VARIABLE_NAME}`]: `${MOCK_EXTENT_4326}` }, true);
    });
  });

  describe('Component lifecycle', () => {
    it('should handle shouldComponentUpdate when map is not initialized', () => {
      const result = panel.shouldComponentUpdate(props);
      expect(result).toBe(true);
    });

    it('should update map size when dimensions change', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const newProps = {
        ...props,
        width: 1000,
        height: 800,
      };

      panel.shouldComponentUpdate(newProps);
      expect(mockMap.updateSize).toHaveBeenCalled();
    });

    it('should handle data changes', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const newData = {
        ...props.data,
        series: [{ fields: [], length: 0 }],
      };

      const newProps = {
        ...props,
        data: newData,
      };

      panel.shouldComponentUpdate(newProps);
      expect(panel.props.data).not.toBe(newData);
    });

    it('should handle componentDidUpdate for dimension changes', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const prevProps = { ...props, width: 600, height: 400 };

      // Update the panel's props
      Object.assign(panel.props, { width: 1000, height: 800 });

      panel.componentDidUpdate(prevProps);
      expect(mockMap.updateSize).toHaveBeenCalled();
    });
  });

  describe('Map initialization edge cases', () => {
    it('should handle null div in initMapAsync', async () => {
      await panel.initMapAsync(null);
      expect(mockMap.dispose).not.toHaveBeenCalled();
    });

    it('should dispose old map on re-initialization', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);
      expect(mockMap.dispose).not.toHaveBeenCalled();

      await panel.initMapAsync(div);
      expect(mockMap.dispose).toHaveBeenCalled();
    });

    it('should handle map initialization without dashboard variable', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      expect(viewOnMock).not.toHaveBeenCalled();
      expect(mockMap.addLayer).toHaveBeenCalled();
      expect(mockMap.addInteraction).toHaveBeenCalled();
    });
  });

  describe('View initialization', () => {
    it('should initialize view with default options', async () => {
      const ViewConstructor = require('ol/View');
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const view = panel.initMapView(props.options.view);
      expect(view).toBeDefined();
      expect(ViewConstructor).toHaveBeenCalled();
    });

    it('should initialize view with noRepeat enabled', async () => {
      const ViewConstructor = require('ol/View');
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const viewConfig = {
        ...props.options.view,
        noRepeat: true,
      };
      const view = panel.initMapView(viewConfig);
      expect(view).toBeDefined();
      expect(ViewConstructor).toHaveBeenCalled();
    });

    it('should handle shared view configuration', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const viewConfig = {
        ...props.options.view,
        shared: true,
      };
      const view1 = panel.initMapView(viewConfig);
      const view2 = panel.initMapView(viewConfig);
      // Both should reference the same shared view
      expect(view1).toBeDefined();
      expect(view2).toBeDefined();
      expect(view1).toBe(view2);
    });
  });

  describe('Tooltip methods', () => {
    it('should clear tooltip when not open', () => {
      panel.state = { ttip: { point: {}, pageX: 100, pageY: 100 }, ttipOpen: false, legends: [] };
      const setStateSpy = jest.spyOn(panel, 'setState');
      panel.clearTooltip();
      expect(setStateSpy).toHaveBeenCalledWith({ ttipOpen: false, ttip: undefined });
    });

    it('should not clear tooltip when open', () => {
      const ttip = { point: {}, pageX: 100, pageY: 100 };
      panel.state = { ttip, ttipOpen: true, legends: [] };
      const setStateSpy = jest.spyOn(panel, 'setState');
      panel.clearTooltip();
      expect(setStateSpy).not.toHaveBeenCalled();
    });

    it('should close tooltip popup', () => {
      const setStateSpy = jest.spyOn(panel, 'setState');
      panel.tooltipPopupClosed();
      expect(setStateSpy).toHaveBeenCalledWith({ ttipOpen: false, ttip: undefined });
    });
  });

  describe('Options changes', () => {
    it('should handle noRepeat option change', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const oldOptions = props.options;
      const newOptions = {
        ...props.options,
        view: {
          ...props.options.view,
          noRepeat: true,
        },
      };

      const initMapAsyncSpy = jest.spyOn(panel, 'initMapAsync');
      panel.optionsChanged(oldOptions, newOptions);

      expect(initMapAsyncSpy).toHaveBeenCalled();
    });

    it('should handle view changes without noRepeat', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const ViewConstructor = require('ol/View');
      ViewConstructor.mockClear();

      const oldOptions = props.options;
      const newOptions = {
        ...props.options,
        view: {
          ...props.options.view,
          zoom: 10,
        },
      };

      panel.optionsChanged(oldOptions, newOptions);
      expect(ViewConstructor).toHaveBeenCalled();
      expect(mockMap.setView).toHaveBeenCalled();
    });

    it('should handle controls changes', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const oldOptions = props.options;
      const newOptions = {
        ...props.options,
        controls: {
          showZoom: false,
          showAttribution: false,
        },
      };

      panel.optionsChanged(oldOptions, newOptions);
      expect(mockMap.getControls).toHaveBeenCalled();
    });
  });

  describe('Data handling', () => {
    it('should handle data changes when panel data matches', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const newData = {
        ...props.data,
        series: [{ fields: [], length: 0 }],
      };

      // Set the panel's props.data to match the data we're passing
      Object.assign(panel.props, { data: newData });

      panel.dataChanged(newData);
      // Verify applyLayerFilter is called via mock
      const { applyLayerFilter } = require('./utils/layers');
      expect(applyLayerFilter).toHaveBeenCalled();
    });
  });

  describe('Legend generation', () => {
    it('should generate legends for layers', () => {
      const legends = panel.getLegends();
      expect(Array.isArray(legends)).toBe(true);
    });

    it('should include legends from handlers when data exists', async () => {
      const { hasLayerData } = require('./utils/utils');
      hasLayerData.mockReturnValue(true);

      const div = document.createElement('div');
      await panel.initMapAsync(div);

      // Add a layer with a legend
      panel.layers = [
        {
          layer: {},
          handler: {
            init: jest.fn(),
            legend: 'Test Legend',
            update: jest.fn(),
          },
          options: { name: 'Test Layer', type: 'test' },
          onChange: jest.fn(),
          mouseEvents: { next: jest.fn(), subscribe: jest.fn() },
          getName: () => 'Test Layer',
        },
      ] as unknown as typeof panel.layers;

      const legends = panel.getLegends();
      expect(legends.length).toBeGreaterThan(0);
    });
  });

  describe('Controls initialization', () => {
    it('should initialize controls with zoom enabled', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      panel.initControls({
        showZoom: true,
        showAttribution: true,
      });

      expect(mockMap.getControls).toHaveBeenCalled();
      expect(mockMap.addControl).toHaveBeenCalled();
    });

    it('should initialize controls with scale', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      panel.initControls({
        showZoom: false,
        showAttribution: false,
        showScale: true,
        scaleUnits: 'metric',
      });

      expect(mockMap.addControl).toHaveBeenCalled();
    });

    it('should toggle mouse wheel zoom', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      panel.initControls({
        showZoom: false,
        showAttribution: false,
        mouseWheelZoom: true,
      });

      expect(panel.mouseWheelZoom?.setActive).toHaveBeenCalledWith(true);
    });

    it('should initialize measure overlay when enabled', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const setStateSpy = jest.spyOn(panel, 'setState');
      panel.initControls({
        showZoom: false,
        showAttribution: false,
        showMeasure: true,
      });

      expect(setStateSpy).toHaveBeenCalled();
    });

    it('should initialize debug overlay when enabled', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const setStateSpy = jest.spyOn(panel, 'setState');
      panel.initControls({
        showZoom: false,
        showAttribution: false,
        showDebug: true,
      });

      expect(setStateSpy).toHaveBeenCalled();
    });

    it('should handle controls when map is not initialized', () => {
      panel.initControls({
        showZoom: true,
        showAttribution: true,
      });

      // Should not throw error
      expect(mockMap.getControls).not.toHaveBeenCalled();
    });
  });

  describe('doOptionsUpdate', () => {
    it('should update options and notify editor', async () => {
      const div = document.createElement('div');
      await panel.initMapAsync(div);

      const onOptionsChangeSpy = jest.fn();
      // Use Object.defineProperty to override readonly property
      Object.defineProperty(panel.props, 'onOptionsChange', {
        value: onOptionsChangeSpy,
        writable: true,
      });

      panel.doOptionsUpdate(0);

      expect(onOptionsChangeSpy).toHaveBeenCalled();
    });
  });
});
