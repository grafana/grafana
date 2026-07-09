jest.mock('ol-mapbox-style', () => ({}));
jest.mock('geotiff', () => ({}));

jest.mock('../layers/registry', () => ({
  DEFAULT_BASEMAP_CONFIG: { type: 'default-basemap', name: 'default' },
  geomapLayerRegistry: { getIfExists: jest.fn() },
}));
jest.mock('../layers/data/markersLayer', () => ({ MARKERS_LAYER_ID: 'markers' }));
jest.mock('./utils', () => ({ getNextLayerName: jest.fn(() => 'Layer 1') }));

import type BaseLayer from 'ol/layer/Base';

import {
  type DataFrame,
  type DataQueryRequest,
  FieldType,
  LoadingState,
  type MapLayerHandler,
  type MapLayerOptions,
  type PanelData,
  textUtil,
  type TimeRange,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { type GeomapPanel } from '../GeomapPanel';
import { geomapLayerRegistry } from '../layers/registry';
import { type MapLayerState } from '../types';

import { applyLayerFilter, getMapLayerState, initLayer } from './layers';

const getIfExists = geomapLayerRegistry.getIfExists as jest.Mock;

describe('applyLayerFilter', () => {
  const createDataFrame = (refId: string): DataFrame => ({
    refId,
    fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3], config: {} }],
    length: 3,
  });

  it('should apply filter when query exists and is visible', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'A' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [createDataFrame('A')],
      })
    );
  });

  it('should return empty series when query exists but is hidden', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'A' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A', hide: true }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [],
      })
    );
  });

  it('should not apply filter when query does not exist', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'C' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(panelData);
  });

  it('should pass through all data when no filter is configured', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(panelData);
  });
});

describe('initLayer', () => {
  const makeLayer = () => ({ setOpacity: jest.fn() }) as unknown as BaseLayer;

  const makeHandler = (layer: BaseLayer) =>
    ({
      init: () => layer,
      update: jest.fn(),
      dispose: jest.fn(),
    }) as unknown as MapLayerHandler;

  const createPanel = () =>
    ({
      map: {},
      byName: new Map<string, MapLayerState>(),
      props: { eventBus: {}, data: {} },
    }) as unknown as GeomapPanel;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unknown layer types', async () => {
    getIfExists.mockReturnValue(undefined);
    await expect(initLayer(createPanel(), {} as never, { type: 'bogus' } as MapLayerOptions, false)).rejects.toBe(
      'unknown layer: bogus'
    );
  });

  it('builds and registers the layer state, and applies opacity', async () => {
    const panel = createPanel();
    const layer = makeLayer();
    const create = jest.fn().mockResolvedValue(makeHandler(layer));
    getIfExists.mockReturnValue({ id: 'markers', create });

    const state = await initLayer(panel, {} as never, { type: 'markers', name: 'My layer', opacity: 0.5 }, false);

    expect(state.options.name).toBe('My layer');
    expect(state.getName()).toBe('My layer');
    expect(state.isBasemap).toBe(false);
    expect(layer.setOpacity).toHaveBeenCalledWith(0.5);
    expect(panel.byName.get('My layer')).toBe(state);
    expect(getMapLayerState(layer)).toBe(state);
  });

  it('names the layer via getNextLayerName when unnamed', async () => {
    const panel = createPanel();
    getIfExists.mockReturnValue({ id: 'markers', create: jest.fn().mockResolvedValue(makeHandler(makeLayer())) });

    const state = await initLayer(panel, {} as never, { type: 'markers' } as MapLayerOptions, false);

    expect(state.options.name).toBe('Layer 1');
  });

  it('sanitizes the attribution config', async () => {
    const spy = jest.spyOn(textUtil, 'sanitizeTextPanelContent').mockReturnValue('SANITIZED');
    const panel = createPanel();
    getIfExists.mockReturnValue({ id: 'markers', create: jest.fn().mockResolvedValue(makeHandler(makeLayer())) });

    const state = await initLayer(
      panel,
      {} as never,
      {
        type: 'markers',
        name: 'x',
        config: { attribution: '<script>alert(1)</script>' },
      } as MapLayerOptions
    );

    expect(spy).toHaveBeenCalledWith('<script>alert(1)</script>');
    expect((state.options.config as { attribution?: string })?.attribution).toBe('SANITIZED');
    spy.mockRestore();
  });

  it('falls back to the markers layer when no type is provided', async () => {
    const panel = createPanel();
    getIfExists.mockReturnValue({ id: 'markers', create: jest.fn().mockResolvedValue(makeHandler(makeLayer())) });

    await initLayer(panel, {} as never, {} as MapLayerOptions, false);

    expect(getIfExists).toHaveBeenCalledWith('markers');
  });

  it('forces the default basemap config when custom base layers are disabled', async () => {
    const original = config.geomapDisableCustomBaseLayer;
    config.geomapDisableCustomBaseLayer = true;
    const panel = createPanel();
    getIfExists.mockReturnValue({
      id: 'default-basemap',
      create: jest.fn().mockResolvedValue(makeHandler(makeLayer())),
    });

    await initLayer(panel, {} as never, { type: 'markers', name: 'x' }, true);

    expect(getIfExists).toHaveBeenCalledWith('default-basemap');
    config.geomapDisableCustomBaseLayer = original;
  });
});

describe('getMapLayerState', () => {
  it('returns undefined for an undefined layer', () => {
    expect(getMapLayerState(undefined)).toBeUndefined();
  });

  it('returns undefined for a layer that was never registered', () => {
    expect(getMapLayerState({} as BaseLayer)).toBeUndefined();
  });
});
