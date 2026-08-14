import { FrameGeometrySourceMode } from '@grafana/schema';

import { type GeomapPanel } from '../GeomapPanel';
import { geomapLayerRegistry } from '../layers/registry';
import { defaultStyleConfig } from '../style/types';
import { type MapLayerState } from '../types';

import { getActions } from './actions';
import { initLayer } from './layers';

jest.mock('../layers/registry', () => ({
  geomapLayerRegistry: {
    getIfExists: jest.fn(),
  },
}));

jest.mock('./layers', () => ({
  initLayer: jest.fn(),
}));

jest.mock('./utils', () => ({
  getNextLayerName: jest.fn(() => 'Layer 1'),
}));

const getIfExists = jest.mocked(geomapLayerRegistry.getIfExists);
const initLayerMock = jest.mocked(initLayer);

const flush = () => new Promise((resolve) => setTimeout(resolve));

function layerState(name: string): MapLayerState {
  return {
    options: { name, type: 'markers' } as MapLayerState['options'],
    layer: { name } as unknown as MapLayerState['layer'],
    handler: {} as MapLayerState['handler'],
    onChange: jest.fn(),
    getName: () => name,
  };
}

function createPanel(overrides: Partial<GeomapPanel> = {}) {
  const group = {
    clear: jest.fn(),
    push: jest.fn(),
  };
  const map = {
    removeLayer: jest.fn(),
    addLayer: jest.fn(),
    getLayers: jest.fn(() => group),
  };
  const panel = {
    layers: [layerState('a'), layerState('b')],
    byName: new Map<string, MapLayerState>(),
    map,
    doOptionsUpdate: jest.fn(),
    panelContext: { onInstanceStateChange: jest.fn() },
    actions: {},
    ...overrides,
  } as unknown as GeomapPanel;
  return { panel, map, group };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getActions', () => {
  describe('selectLayer', () => {
    it('reports the selected index through the panel context', () => {
      const { panel } = createPanel();
      getActions(panel).selectLayer('b');
      expect(panel.panelContext!.onInstanceStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ selected: 1, map: panel.map, layers: panel.layers })
      );
    });

    it('does nothing when there is no panel context', () => {
      const { panel } = createPanel({ panelContext: undefined });
      expect(() => getActions(panel).selectLayer('b')).not.toThrow();
    });
  });

  describe('canRename', () => {
    it('is false when the name is already taken', () => {
      const { panel } = createPanel();
      panel.byName.set('taken', layerState('taken'));
      const actions = getActions(panel);
      expect(actions.canRename('taken')).toBe(false);
      expect(actions.canRename('free')).toBe(true);
    });
  });

  describe('deleteLayer', () => {
    it('removes the matching layer from the map and state', () => {
      const { panel, map } = createPanel();
      const removed = panel.layers[0];
      getActions(panel).deleteLayer('a');

      expect(map.removeLayer).toHaveBeenCalledWith(removed.layer);
      expect(panel.layers).toHaveLength(1);
      expect(panel.layers[0].getName()).toBe('b');
      expect(panel.doOptionsUpdate).toHaveBeenCalledWith(0);
    });
  });

  describe('addlayer', () => {
    it('ignores unknown layer types', () => {
      const { panel } = createPanel();
      getIfExists.mockReturnValue(undefined);

      getActions(panel).addlayer('does-not-exist');

      expect(initLayerMock).not.toHaveBeenCalled();
    });

    it('initializes and appends a known layer type', async () => {
      const { panel, map } = createPanel();
      const newLayer = layerState('Layer 1');
      getIfExists.mockReturnValue({
        id: 'markers',
        name: 'Markers',
        create: jest.fn(),
        defaultOptions: { foo: 'bar' },
        showLocation: true,
        hideOpacity: false,
      });
      initLayerMock.mockResolvedValue(newLayer);

      getActions(panel).addlayer('markers');

      expect(initLayerMock).toHaveBeenCalledWith(
        panel,
        panel.map,
        expect.objectContaining({
          type: 'markers',
          name: 'Layer 1',
          config: { foo: 'bar' },
          location: { mode: FrameGeometrySourceMode.Auto },
          tooltip: true,
          opacity: defaultStyleConfig.opacity,
        }),
        false
      );

      await flush();

      expect(panel.layers).toContain(newLayer);
      expect(map.addLayer).toHaveBeenCalledWith(newLayer.layer);
      expect(panel.doOptionsUpdate).toHaveBeenLastCalledWith(panel.layers.length - 1);
    });

    it('omits opacity and location when the layer type opts out', async () => {
      const { panel } = createPanel();
      getIfExists.mockReturnValue({
        id: 'basemap',
        name: 'Basemap',
        create: jest.fn(),
        defaultOptions: {},
        showLocation: false,
        hideOpacity: true,
      });
      initLayerMock.mockResolvedValue(layerState('Layer 1'));

      getActions(panel).addlayer('basemap');

      const options = initLayerMock.mock.calls[0][2];
      expect(options.location).toBeUndefined();
      expect(options.opacity).toBeUndefined();
    });
  });

  describe('reorder', () => {
    it('moves a layer and rebuilds the map layer group in order', () => {
      const { panel, group } = createPanel();
      getActions(panel).reorder(0, 1);

      expect(panel.layers.map((l) => l.getName())).toEqual(['b', 'a']);
      expect(group.clear).toHaveBeenCalled();
      expect(group.push).toHaveBeenCalledTimes(2);
      expect(group.push).toHaveBeenNthCalledWith(1, panel.layers[0].layer);
      expect(group.push).toHaveBeenNthCalledWith(2, panel.layers[1].layer);
      expect(panel.doOptionsUpdate).toHaveBeenCalledWith(1);
    });
  });
});
