import Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import Point from 'ol/geom/Point';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import TileSource from 'ol/source/Tile';
import VectorSource from 'ol/source/Vector';

import { getTemplateSrv } from '@grafana/runtime';

// Mock the config module to avoid undefined panels error
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

// Mock the dimensions module since it's imported by utils.ts
jest.mock('app/features/dimensions/color', () => ({
  getColorDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/scalar', () => ({
  getScalarDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/scale', () => ({
  getScaledDimension: jest.fn(),
}));
jest.mock('app/features/dimensions/text', () => ({
  getTextDimension: jest.fn(),
}));

// Mock the grafana datasource since it's imported by utils.ts
jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  getGrafanaDatasource: jest.fn(),
}));

import { type GeomapPanel } from '../GeomapPanel';
import { type MapLayerState } from '../types';

import { hasVariableDependencies, hasLayerData, isSegmentVisible, getNextLayerName } from './utils';

// Test fixtures
const createTestFeature = () => new Feature(new Point([0, 0]));

const createTestVectorSource = (hasFeature = false): VectorSource<Feature<Point>> => {
  const source = new VectorSource<Feature<Point>>();
  if (hasFeature) {
    source.addFeature(createTestFeature());
  }
  return source;
};

const createTestWebGLStyle = () => ({
  'circle-radius': 8,
  'circle-fill-color': '#000000',
  'circle-opacity': 1,
});

describe('hasVariableDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      name: 'object contains an existing template variable',
      variables: [{ name: 'variable' }],
      obj: { key: '$variable' },
      expected: true,
    },
    {
      name: 'object references a template variable that does not exist',
      variables: [{ name: 'variable' }],
      obj: { key: '$nonexistent' },
      expected: false,
    },
    {
      name: 'object has no template variable syntax',
      variables: [] as Array<{ name: string }>,
      obj: { key: 'static value' },
      expected: false,
    },
    {
      name: 'nested object contains an existing template variable',
      variables: [{ name: 'variable' }],
      obj: {
        key: 'static value',
        nested: { anotherKey: '$variable' },
      },
      expected: true,
    },
  ])('$name', ({ variables, obj, expected }) => {
    const mockTemplateSrv = {
      containsTemplate: jest
        .fn()
        .mockImplementation((str: string) => variables.some((v) => str.includes(`$${v.name}`))),
      getVariables: jest.fn().mockReturnValue(variables),
    };
    (getTemplateSrv as jest.Mock).mockReturnValue(mockTemplateSrv);

    expect(hasVariableDependencies(obj)).toBe(expected);
    expect(mockTemplateSrv.containsTemplate).toHaveBeenCalledWith(JSON.stringify(obj));
  });
});

describe('hasLayerData', () => {
  it.each([
    {
      name: 'empty vector layer',
      expected: false,
      createLayer: () =>
        new VectorLayer({
          source: createTestVectorSource(),
        }),
    },
    {
      name: 'vector layer with features',
      expected: true,
      createLayer: () =>
        new VectorLayer({
          source: createTestVectorSource(true),
        }),
    },
    {
      name: 'layer group with vector layer that has data',
      expected: true,
      createLayer: () =>
        new LayerGroup({
          layers: [
            new VectorLayer({
              source: createTestVectorSource(true),
            }),
          ],
        }),
    },
    {
      name: 'empty layer group',
      expected: false,
      createLayer: () =>
        new LayerGroup({
          layers: [],
        }),
    },
    {
      name: 'tile layer with source',
      expected: true,
      createLayer: () =>
        new TileLayer({
          source: new TileSource({}),
        }),
    },
    {
      name: 'tile layer without source',
      expected: false,
      createLayer: () => new TileLayer({}),
    },
    {
      name: 'WebGLPointsLayer with features',
      expected: true,
      createLayer: () =>
        new WebGLPointsLayer({
          source: createTestVectorSource(true),
          style: createTestWebGLStyle(),
        }),
    },
    {
      name: 'empty WebGLPointsLayer',
      expected: false,
      createLayer: () =>
        new WebGLPointsLayer({
          source: createTestVectorSource(),
          style: createTestWebGLStyle(),
        }),
    },
    {
      name: 'layer group with WebGLPointsLayer that has data',
      expected: true,
      createLayer: () =>
        new LayerGroup({
          layers: [
            new WebGLPointsLayer({
              source: createTestVectorSource(true),
              style: createTestWebGLStyle(),
            }),
          ],
        }),
    },
  ])('$name', ({ createLayer, expected }) => {
    expect(hasLayerData(createLayer())).toBe(expected);
  });
});

describe('getNextLayerName', () => {
  function panelWith(layerCount: number, takenNames: string[] = []): GeomapPanel {
    const byName = new Map<string, MapLayerState>();
    for (const n of takenNames) {
      byName.set(n, {} as MapLayerState);
    }
    return { layers: new Array(layerCount).fill({}), byName } as unknown as GeomapPanel;
  }

  it('returns the first available name starting at panel.layers.length', () => {
    const name = getNextLayerName(panelWith(0));
    // i18n in jest returns the fallback template with interpolation: "Layer 0".
    expect(name).toMatch(/\b0\b/);
  });

  it('skips a name that is already present in byName', () => {
    const occupied = getNextLayerName(panelWith(1));
    const second = getNextLayerName(panelWith(1, [occupied]));
    expect(second).not.toBe(occupied);
    expect(second).toMatch(/\b2\b/);
  });

  it('falls back to a Date.now()-based name once 100 layers exist', () => {
    const before = Date.now();
    const name = getNextLayerName(panelWith(100));
    const after = Date.now();
    // The numeric portion of the returned name should be the timestamp captured during the call.
    const numeric = Number(name.match(/\d+/)?.[0] ?? NaN);
    expect(numeric).toBeGreaterThanOrEqual(before);
    expect(numeric).toBeLessThanOrEqual(after);
  });
});

describe('isSegmentVisible', () => {
  const map = {
    getPixelFromCoordinate: (coord: number[]) => coord,
  } as unknown as OpenLayersMap;

  it.each([
    {
      name: 'segment spans more pixels than tolerance',
      pixelTolerance: 1,
      start: [0, 0],
      end: [10, 0],
      expected: true,
    },
    {
      name: 'segment is within pixel tolerance',
      pixelTolerance: 5,
      start: [0, 0],
      end: [1, 1],
      expected: false,
    },
  ])('$name', ({ pixelTolerance, start, end, expected }) => {
    expect(isSegmentVisible(map, pixelTolerance, start, end)).toBe(expected);
  });
});
