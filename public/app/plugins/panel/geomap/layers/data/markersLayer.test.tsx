import Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import { Point } from 'ol/geom';
import type LayerGroup from 'ol/layer/Group';
import VectorImageLayer from 'ol/layer/VectorImage';

import {
  createTheme,
  FieldType,
  FrameGeometrySourceMode,
  LoadingState,
  toDataFrame,
  type EventBus,
  type MapLayerOptions,
  type PanelData,
  type PanelOptionsEditorBuilder,
  type StandardEditorContext,
  type TimeRange,
} from '@grafana/data';

import {
  getClusterFixedColor,
  hidePointFeature,
  markersLayer,
  type MarkersConfig,
  setPointFeatureProperties,
} from './markersLayer';

// getLocationMatchers always loads a gazetteer, which would hit the network
// (unavailable under jsdom). Coords mode does not use it for geometry, so stub it.
jest.mock('app/features/geo/gazetteer/gazetteer', () => ({
  ...jest.requireActual('app/features/geo/gazetteer/gazetteer'),
  getGazetteer: jest.fn().mockResolvedValue({ path: 'test', find: () => undefined, examples: () => [], count: 0 }),
}));

const theme = createTheme();

describe('markers layer helpers', () => {
  describe('getClusterFixedColor', () => {
    it('returns undefined when no color is configured', () => {
      expect(getClusterFixedColor(undefined, theme)).toBeUndefined();
      expect(getClusterFixedColor('', theme)).toBeUndefined();
    });

    it('resolves a hex color to RGB channels', () => {
      expect(getClusterFixedColor('#3274d9', theme)).toEqual({ red: 50, green: 116, blue: 217, opacity: 1 });
    });

    it('resolves a named theme color to RGB channels', () => {
      const color = getClusterFixedColor('red', theme);
      expect(color).toBeDefined();
      expect(color?.opacity).toBe(1);
    });
  });

  describe('setPointFeatureProperties / hidePointFeature', () => {
    it('writes WebGL render properties from style values', () => {
      const feature = new Feature<Point>({ geometry: new Point([0, 0]) });

      setPointFeatureProperties(feature, { color: '#ff0000', size: 5, opacity: 1, rotation: 0 }, theme);

      expect(feature.get('red')).toBe(255);
      expect(feature.get('green')).toBe(0);
      expect(feature.get('blue')).toBe(0);
      expect(feature.get('size')).toBe(10); // size * 2
      expect(feature.get('opacity')).toBe(1);
    });

    it('zeroes render properties to hide a feature', () => {
      const feature = new Feature<Point>({ geometry: new Point([0, 0]) });
      setPointFeatureProperties(feature, { color: '#ff0000', size: 5, opacity: 1 }, theme);

      hidePointFeature(feature);

      expect(feature.get('size')).toBe(0);
      expect(feature.get('opacity')).toBe(0);
      expect(feature.get('red')).toBe(0);
    });
  });
});

describe('markersLayer create (clustered)', () => {
  const mockMap = () => {
    const view = { getMaxZoom: () => 18, getZoom: () => 5 };
    return { getView: () => view, on: jest.fn(), un: jest.fn() } as unknown as OpenLayersMap;
  };

  const clusterOptions = (config?: Partial<MarkersConfig>): MapLayerOptions<MarkersConfig> => ({
    type: 'markers',
    name: 'Test',
    location: { mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lng' },
    config: { cluster: { enabled: true }, ...config } as MarkersConfig,
  });

  const mockBuilder = () => ({
    addCustomEditor: jest.fn().mockReturnThis(),
    addBooleanSwitch: jest.fn().mockReturnThis(),
    addSliderInput: jest.fn().mockReturnThis(),
    addColorPicker: jest.fn().mockReturnThis(),
  });

  it('builds a handler and wires the zoom-based unclustering listener', async () => {
    const map = mockMap();

    const handler = await markersLayer.create(map, clusterOptions(), {} as EventBus, theme);

    expect(handler.init()).toBeDefined();
    expect(typeof handler.update).toBe('function');
    expect(typeof handler.dispose).toBe('function');
    expect(map.on).toHaveBeenCalledWith('moveend', expect.any(Function));
  });

  it('registers the cluster options in the editor, gated on cluster.enabled', async () => {
    const handler = await markersLayer.create(mockMap(), clusterOptions(), {} as EventBus, theme);
    const builder = mockBuilder();

    handler.registerOptionsUI!(
      builder as unknown as PanelOptionsEditorBuilder<MapLayerOptions<MarkersConfig>>,
      {} as unknown as StandardEditorContext<MapLayerOptions<MarkersConfig>>
    );

    expect(builder.addBooleanSwitch).toHaveBeenCalledWith(expect.objectContaining({ path: 'config.cluster.enabled' }));
    expect(builder.addColorPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'config.cluster.color',
        // The description says "leave empty to blend", so the picker must be clearable
        // back to undefined once a fixed color has been chosen.
        settings: expect.objectContaining({ isClearable: true }),
      })
    );
    const sliderPaths = builder.addSliderInput.mock.calls.map((call) => call[0].path);
    expect(sliderPaths).toEqual(
      expect.arrayContaining(['config.cluster.radius', 'config.cluster.maxZoom', 'config.cluster.minPoints'])
    );

    // Every cluster sub-option (sliders + color) is only shown when clustering is enabled
    const gatedEditors = [...builder.addSliderInput.mock.calls, ...builder.addColorPicker.mock.calls].map(
      (call) => call[0]
    );
    expect(gatedEditors).toHaveLength(4);
    for (const editor of gatedEditors) {
      expect(editor.showIf({ config: { cluster: { enabled: true } } })).toBe(true);
      expect(editor.showIf({ config: { cluster: { enabled: false } } })).toBe(false);
    }
  });

  it('removes the moveend listener on dispose', async () => {
    const map = mockMap();
    const handler = await markersLayer.create(map, clusterOptions(), {} as EventBus, theme);

    handler.dispose!();

    expect(map.un).toHaveBeenCalledWith('moveend', expect.any(Function));
  });

  it('never declutters the cluster count text, since its badge is on a non-declutterable WebGL layer', async () => {
    const handler = await markersLayer.create(mockMap(), clusterOptions(), {} as EventBus, theme);
    const layers = (handler.init() as LayerGroup).getLayers().getArray();
    // The cluster text layer is always appended last (after the line, singleton, and badge layers)
    const clusterTextLayer = layers.filter((l): l is VectorImageLayer => l instanceof VectorImageLayer).at(-1);

    expect(clusterTextLayer).toBeDefined();
    expect(clusterTextLayer!.getDeclutter()).toBeFalsy();
  });

  it('handles updates with data and with empty series', async () => {
    const handler = await markersLayer.create(mockMap(), clusterOptions(), {} as EventBus, theme);
    const frame = toDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [0, 0.0001, 40] },
        { name: 'lng', type: FieldType.number, values: [0, 0.0001, -100] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    const base = { state: LoadingState.Done, timeRange: {} as TimeRange };

    expect(() => handler.update!({ ...base, series: [frame] } as PanelData)).not.toThrow();
    expect(() => handler.update!({ ...base, series: [] } as PanelData)).not.toThrow();
  });
});
